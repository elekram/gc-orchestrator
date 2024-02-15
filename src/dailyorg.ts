import * as parseDate from 'std/datetime/mod.ts'
import appSettings from '../config/config.ts'

import { Store } from './store.ts'

export function addDailyOrgReplacementsToStore(
  store: Store,
  teacherReplacementsCsv: Record<string, string>[],
) {
  const replacementTeacherSchedule = getTodaysTeacherReplacements(
    store,
    teacherReplacementsCsv,
  )

  const dailyOrgReplacementClasses: Map<string, {
    subjectStudents: Set<string>
    subjectTeachers: Set<string>
    students: Set<string>
  }> = new Map()

  for (const [teacher, classes] of replacementTeacherSchedule) {
    for (const c of classes) {
      const classCodeWithoutSemesterPrefix = c.substring(1)

      let code = classCodeWithoutSemesterPrefix

      for (const [compositeClass, props] of store.timetable.compositeClasses) {
        if (props.classCodes.has(classCodeWithoutSemesterPrefix)) {
          code = compositeClass.split('.')[1]
        }
      }

      const teachers: Set<string> = new Set()
      teachers.add(teacher)

      if (!dailyOrgReplacementClasses.has(code)) {
        dailyOrgReplacementClasses.set(code, {
          subjectTeachers: new Set(teachers),
          students: new Set(),
          subjectStudents: new Set(),
        })
      }
      dailyOrgReplacementClasses.get(code)?.subjectTeachers.add(
        teacher,
      )
    }
  }

  console.log(
    `%c[ ${dailyOrgReplacementClasses.size} scheduled replacements added to Store from dailyorg for today ]\n`,
    'color:green',
  )

  store.replacements.dailyorgReplacements = dailyOrgReplacementClasses
}

function getTodaysTeacherReplacements(
  store: Store,
  teacherReplacements: Record<string, string>[],
) {
  const enrolments: Map<string, Set<string>> = new Map()
  if (!teacherReplacements) return enrolments

  for (const row of teacherReplacements) {
    const replacmentClass = row['Class Code']
    if (isExceptedSubject(store, replacmentClass)) continue

    const todaysDate = new Date().setHours(0, 0, 0, 0)
    if (!row.Date) continue

    const dailyOrgDate = parseDate.parse(
      row.Date.replaceAll('/', '-'),
      'd-MM-yyyy',
    )

    if (todaysDate !== dailyOrgDate.getTime()) continue

    const replacementTeacher = `${
      row['Replacement Teacher Code']?.toLowerCase()
    }${appSettings.domain}`

    if (!replacmentClass) continue
    if (!replacementTeacher) continue

    if (!enrolments.has(replacementTeacher)) {
      enrolments.set(replacementTeacher, new Set())
      enrolments.get(replacementTeacher)?.add(replacmentClass)
    }

    enrolments.get(replacementTeacher)?.add(replacmentClass)
  }

  return enrolments
}

function isExceptedSubject(store: Store, replacementClasscode: string) {
  let exceptedSubject = false

  for (const [code, _c] of store.timetable.classes) {
    const subjectCode = code.split('.')[0]
    const classCode = code.split('.')[1]
    if (
      classCode === replacementClasscode.substring(1) &&
      appSettings.subjectExceptions.includes(subjectCode)
    ) {
      exceptedSubject = true
    }
  }
  return exceptedSubject
}
