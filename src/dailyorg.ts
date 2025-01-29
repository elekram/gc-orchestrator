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
      const classcode = c
      let code = classcode

      for (const [compositeClass, props] of store.timetable.compositeClasses) {
        if (props.classCodes.has(classcode)) {
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
    const replacmentClass = row['Class'].trim()

    let isClassInTimetable = false
    for (const [code, _props] of store.timetable.classes) {
      if (code.includes(replacmentClass)) {
        isClassInTimetable = true
      }
    }

    if (!isClassInTimetable) continue
    if (!replacmentClass) continue
    if (replacmentClass === "-") continue

    if (isExceptedSubject(store, replacmentClass)) continue

    if (!row.Date) continue

    const todaysDate = new Date().setHours(0, 0, 0, 0)
    const parsedDate = Date.parse(row.Date)
    const dailyOrgDate = new Date(parsedDate)

    if (todaysDate !== dailyOrgDate.getTime()) continue

    if (!row['Substitute Code']) continue
    if (row['Substitute Code'].trim() === "-") continue

    const replacementTeacher = `${row['Substitute Code']?.toLowerCase()
      }${appSettings.domain}`

    if (!enrolments.has(replacementTeacher)) {
      enrolments.set(replacementTeacher, new Set())
      enrolments.get(replacementTeacher)?.add(replacmentClass)
      continue
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
      classCode === replacementClasscode &&
      appSettings.subjectExceptions.includes(subjectCode)
    ) {
      exceptedSubject = true
    }
  }
  return exceptedSubject
}
