import { parse } from 'std/csv/mod.ts'
import * as parseDate from 'std/datetime/mod.ts'
import appSettings from '../config/config.ts'
import { TimetabledCourse } from './tasks.ts'
import { Enrolments } from './subjects-and-classes.ts'
import { Store } from './store.ts'

const dailyorgFileLocation = appSettings.dailyorgFileLocation
const teacherReplacementsFile = appSettings.teacherPeriodReplacementsFileName

const teacherReplacementsCsv = parse(
  await Deno.readTextFile(`${dailyorgFileLocation}${teacherReplacementsFile}`),
  { skipFirstRow: true },
) as Record<string, string>[]

export function addDailyOrgReplacementsToStore(store: Store) {
  const replacementTeacherSchedule = getTodaysTeacherReplacements(
    teacherReplacementsCsv,
  )

  const dailyOrgReplacementClasses: Map<string, Enrolments> = new Map()

  for (const [teacher, classes] of replacementTeacherSchedule) {
    for (const c of classes) {
      const classCodeWithoutSemesterPrefix = c.substring(1)

      const teachers: Set<string> = new Set()
      teachers.add(teacher)

      if (!dailyOrgReplacementClasses.has(classCodeWithoutSemesterPrefix)) {
        dailyOrgReplacementClasses.set(classCodeWithoutSemesterPrefix, {
          subjectTeachers: new Set(teachers),
          students: new Set(),
        })
      }
      dailyOrgReplacementClasses.get(classCodeWithoutSemesterPrefix)?.subjectTeachers.add(
        teacher,
      )
    }
  }

  console.log(
    `%c[ ${dailyOrgReplacementClasses.size} Scheduled Replacements added to Store from Dailyorg ]\n`,
    'color:green',
  )

  store.replacements.dailyorgReplacements = dailyOrgReplacementClasses
}

function getTodaysTeacherReplacements(
  teacherReplacements: Record<string, string>[],
) {
  const enrolments: Map<string, Set<string>> = new Map()
  if (!teacherReplacements) return enrolments

  for (const row of teacherReplacements) {
    const todaysDate = new Date().setHours(0, 0, 0, 0)

    if (!row.Date) continue

    const dailyOrgDate = parseDate.parse(
      row.Date.replaceAll('/', '-'),
      'd-MM-yyyy',
    )

    if (todaysDate !== dailyOrgDate.getTime()) continue

    const replacmentClass = row['Class Code']

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
