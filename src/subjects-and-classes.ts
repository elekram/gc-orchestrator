import { parse } from 'std/csv/mod.ts'
import appSettings from '../config/config.ts'
import { Store } from './store.ts'
import { tinyLogger } from './deps.ts'
import { format } from 'std/datetime/format.ts'

export interface Class {
  subjectCode: string
  classCodeWithSemeterPrefix: string
  name: string
  domain: string
  subjectLeaders: Set<string>
  subjectTeachers: Set<string>
  classTeachers: Set<string>
  subjectStudents: Set<string>
  students: Set<string>
  periodSchedule: Map<number, Set<number>>
  isComposite: boolean
  isExceptedSubject: boolean
}

export interface CompositeClass {
  classCodes: Set<string>
  classCodesWithSemeterPrefix: Set<string>
  subjectNames: Set<string>
  subjectLeaders: Set<string>
  subjectTeachers: Set<string>
  classTeachers: Set<string>
  domain: string
  subjectStudents: Set<string>
  students: Set<string>
}

const gooogleDomain = String(appSettings.domain)
const csvFileLocation = appSettings.csvFileLocation
const classNamesCsvFile = appSettings.classNamesCsv
const timetableCsvFile = appSettings.timetableCsv
const studentLessonsCsvFile = appSettings.studentLessonsCsv
const unscheduledDutiesCsvFile = appSettings.unscheduledDutiesCsvFileName
const subjectExceptions = appSettings.subjectExceptions
const classExceptions = appSettings.compositeClassExceptions
const subjectAdmins = appSettings.subjectAdmins

const classNames = parse(
  await Deno.readTextFile(`${csvFileLocation}${classNamesCsvFile}`),
  { skipFirstRow: true },
)

const timetable = parse(
  await Deno.readTextFile(`${csvFileLocation}${timetableCsvFile}`),
  { skipFirstRow: true },
)

const studentLessons = parse(
  await Deno.readTextFile(`${csvFileLocation}${studentLessonsCsvFile}`),
  { skipFirstRow: true },
)

const unscheduledDuties = parse(
  await Deno.readTextFile(`${csvFileLocation}${unscheduledDutiesCsvFile}`),
  { skipFirstRow: true },
)

export function addTimetableToStore(store: Store) {
  // const compositeClassCodes = getCompositeClasses(classExceptions).classCodes()

  const timetable = getSubjectsAndClasses(
    // compositeClassCodes,
    subjectExceptions,
  )

  console.log(timetable)
  return

  store.timetable.subjects = timetable.subjects
  store.timetable.classes = timetable.classes
  store.timetable.compositeClasses = getCompositeClasses(classExceptions)
    .classes()

  console.log(
    `\n%c[ ${store.timetable.subjects.size} subjects added to Store from timetable ]`,
    'color:green',
  )

  console.log(
    `\n%c[ ${store.timetable.classes.size} classes added to Store from timetable ]`,
    'color:green',
  )

  console.log(
    `\n%c[ ${store.timetable.compositeClasses.size} composite classes added to Store from timetable ]\n`,
    'color:green',
  )
}

function getCompositeClasses(classExceptions: string[]) {
  const teacherSchedules: Map<string, Set<string>> = new Map()
  const compositeClassCodes: Set<string> = new Set()

  for (const row of timetable) {
    const schedule = `D${row['Day No']}P${row['Period No']}${row['Teacher Code']}`

    if (!row['Class Code']) continue
    if (classExceptions.includes(row['Class Code'])) continue

    const classes: Set<string> = new Set()
    classes.add(row['Class Code'])

    if (teacherSchedules.has(schedule)) {
      teacherSchedules.get(schedule)?.add(row['Class Code'])
      continue
    }

    teacherSchedules.set(schedule, classes)
  }

  const compositeClasses: Map<string, CompositeClass> = new Map()

  for (const classes of teacherSchedules) {
    if (classes[1].size < 2) continue

    const sortedClassCodes = [...(classes[1])].sort()

    let compositeClassName = ''
    let subjectCode = ''
    let domain = ''
    const classCodes: Set<string> = new Set()
    const classCodesWithSemeterPrefix: Set<string> = new Set()
    const subjectNames: Set<string> = new Set()
    const subjectTeachers: Set<string> = new Set()
    const classTeachers: Set<string> = new Set()
    const students: Set<string> = new Set()

    for (const classCode of sortedClassCodes) {
      const c = classNames.filter((c) => {
        return c['Class Code'] === classCode
      })

      if (c[0]['Course Code']) {
        subjectCode = c[0]['Course Code']
      }

      if (c[0]['Faculty Name']) {
        domain = c[0]['Faculty Name'].split('_')[0].toUpperCase()
      }

      if (c[0]['Course Name']) {
        subjectNames.add(
          c[0]['Course Name'].replace(/['"]+/g, ''),
        )
      }

      if (!isValidCode(subjectCode)) {
        continue
      }

      if (!isValidCode(classCode)) {
        continue
      }

      if (!classExceptions.includes(classCode)) {
        compositeClassCodes.add(classCode.substring(1))
      }

      classCodes.add(classCode.substring(1))
      classCodesWithSemeterPrefix.add(classCode)
      compositeClassName += `${classCode.substring(1)}-`

      const leaders = getLeaders(domain)
      const teachersFromSubjectCode = getSubjectTeachers(
        subjectCode,
        domain,
        subjectAdmins,
      )
      const teachersFromClassCode = getClassTeachers(classCode)
      const studentsFromClassCode = getStudents(classCode)

      leaders?.forEach((leader) => subjectTeachers.add(leader))

      teachersFromSubjectCode.forEach(subjectTeachers.add, subjectTeachers)
      teachersFromClassCode.forEach(classTeachers.add, classTeachers)
      studentsFromClassCode.forEach(students.add, students)
    }

    const trimmedCompositeClassName = compositeClassName.slice(0, -1)

    compositeClasses.set(`COMPOSITE.${trimmedCompositeClassName}`, {
      subjectNames,
      classCodes,
      classCodesWithSemeterPrefix,
      subjectLeaders: new Set(getLeaders(domain)),
      subjectTeachers: new Set(subjectTeachers),
      classTeachers: new Set(classTeachers),
      domain,
      students: new Set(students),
      subjectStudents: new Set(),
    })
  }

  return {
    classes: () => {
      return compositeClasses
    },
    classCodes: () => {
      return compositeClassCodes
    },
  }
}

export function getSubjectsAndClasses(
  // compositeClassCodes: Set<string>,
  subjectExceptions: string[],
) {
  const classes: Map<string, Class> = new Map()
  const subjects = new Set<string>()
  for (const row of classNames) {
    const subjectCodeWithSemeterPrefix = row['Course Code'] as string
    const classCodeWithSemeterPrefix = row['Class Code'] as string

    // if (!isValidCode(subjectCodeWithSemeterPrefix)) {
    //   continue
    // }

    // if (!isValidCode(classCodeWithSemeterPrefix)) {
    //   continue
    // }

    // const subjectCode = (row['Subject Code'] as string).substring(1)
    // const classCode = (row['Class Code'] as string).substring(1)
    const subjectCode = subjectCodeWithSemeterPrefix
    if (subjectCode === "" || subjectCode == "-") {
      continue
    }
    const classCode = classCodeWithSemeterPrefix
    if (classCode === "" || classCode == "-") {
      continue
    }

    const name = (row['Course Name'] as string).replace(/['"]+/g, '')

    if (name === "" || name === "-") {
      continue
    }

    const domain = (row['Faculty Name'] as string).split('-')[0].toUpperCase().trim()
    const leaders = getLeaders(domain)
    const subjectTeachers = getSubjectTeachers(
      subjectCodeWithSemeterPrefix,
      domain,
      subjectAdmins,
    )
    const classTeachers = getClassTeachers(classCodeWithSemeterPrefix)
    const subjectStudents = getSubjectStudents(subjectCodeWithSemeterPrefix)
    const students = getStudents(classCodeWithSemeterPrefix)

    subjects.add(subjectCode)

    leaders?.forEach((leader) => subjectTeachers.add(leader))
    const periodSchedule = getPeriodSchedule(classCodeWithSemeterPrefix)

    let isExceptedSubject = false
    if (subjectExceptions.includes(subjectCode)) {
      isExceptedSubject = true
    }

    // let isComposite = false
    // if (compositeClassCodes.has(classCode)) {
    //   isComposite = true
    // }

    const c: Class = {
      subjectCode,
      classCodeWithSemeterPrefix,
      name,
      domain,
      subjectLeaders: new Set<string>(leaders),
      subjectTeachers: new Set<string>(subjectTeachers),
      classTeachers: new Set<string>(classTeachers),
      subjectStudents: new Set<string>(subjectStudents),
      students: new Set<string>(students),
      periodSchedule,
      isComposite: false,
      isExceptedSubject,
    }

    classes.set(`${subjectCode}.${classCode}`, c)
  }

  return { classes, subjects }
}

function getClassTeachers(classCodeWithSemeterPrefix: string) {
  const classTeachers: Set<string> = new Set()

  for (const row of timetable) {
    if (row['Class Code'] == classCodeWithSemeterPrefix) {
      if (!row['Teacher Code']) continue

      classTeachers.add(
        `${row['Teacher Code'].toLowerCase()}${appSettings.domain}`,
      )
    }
  }
  return classTeachers
}

function getPeriodSchedule(classCode: string) {
  const periodSchedule: Map<number, Set<number>> = new Map()

  for (const row of timetable) {
    if (row['Class Code'] !== classCode) continue

    const dayNumber = Number(row['Day No'])
    const periodNumber = Number(row['Period No'])

    if (periodSchedule.has(dayNumber)) {
      periodSchedule.get(dayNumber)?.add(periodNumber)
      continue
    }

    periodSchedule.set(dayNumber, new Set<number>())
    periodSchedule.get(dayNumber)?.add(periodNumber)
  }
  return periodSchedule
}

function getLeaders(domain: string): Set<string> | undefined {
  const domains: Map<string, Set<string>> = new Map()

  for (const row of unscheduledDuties) {
    const hasDomainLeaderRow: boolean = (row['Responsibility'] as string).includes(
      'Domain Leader',
    )

    if (hasDomainLeaderRow) {
      const domainName = (row['Responsibility'] as string).split('-')[1]
        .toUpperCase().trim()
      const domainLeader = (row['Code'] as string).toLowerCase()
      const username = domainLeader + gooogleDomain

      if (!domains.has(domainName)) {
        domains.set(domainName, new Set())
      }
      domains.get(domainName)?.add(username)
    }
  }
  return domains.get(domain)
}

function getStudents(classCode: string): Set<string> {
  const students = new Set<string>()

  for (const row of studentLessons) {
    if (row['Class Name'] === classCode) {
      const student = row['Student Code'] as string

      if (student) {
        const username = student + gooogleDomain
        students.add(username.toLowerCase())
      }
    }
  }
  return students
}

function getSubjectStudents(subjectCode: string): Set<string> {
  const subjectStudents = new Set<string>()

  for (const row of classNames) {
    if (row['Course Code'] === subjectCode) {
      if (!row['Class Code']) continue
      const students = getStudents(row['Class Code'])

      for (const student of students) {
        subjectStudents.add(student)
      }
    }
  }

  return subjectStudents
}

function getSubjectTeachers(
  code: string,
  domain: string,
  subjectAdmins: Map<string, string>,
): Set<string> {
  const teachers = new Set<string>()

  for (const row of timetable) {
    const classCode = row['Class Code'] as string
    if (classCode.includes(code)) {
      const teacher = row['Teacher Code'] as string
      if (teacher) {
        teachers.add(teacher.toLowerCase() + gooogleDomain)
      }
    }
  }

  const domainTeacher = subjectAdmins.get(domain)
  if (domainTeacher) teachers.add(domainTeacher)

  return teachers
}

function isValidCode(code: string): boolean {
  let isValid = true
  const validYearLevels = ['01', '07', '08', '09', '10', '11', '12']
  const validSemesterNumbers = /[1|2]/
  const isNumber = /[0-9]/
  const isLetter = /[A-Z]/

  const prefix = code[0]

  if (!validSemesterNumbers.test(prefix)) {
    isValid = false
  }

  if (code.length < 6) {
    isValid = false
  }

  const qualifier = code.charAt(4)

  if (isNumber.test(qualifier)) {
    // code with 3 letter subject
    if (!/^[A-Z]+$/.test(code.substring(1, 4))) {
      isValid = false
    }

    if (!validYearLevels.includes(code.substring(6, 4))) {
      isValid = false
    }

    if (code.length > 6) {
      if (!/^[A-Z|0-9]+$/.test(code.substring(6))) {
        isValid = false
      }
    }
  } else if (isLetter.test(qualifier)) {
    // code with 4 letter subject
    if (!/^[A-Z]+$/.test(code.substring(1, 5))) {
      isValid = false
    }

    if (!validYearLevels.includes(code.substring(5, 7))) {
      isValid = false
    }

    if (code.length > 7) {
      if (!/^[A-Z|0-9]+$/.test(code.substring(7))) {
        isValid = false
      }
    }
  }

  if (!isValid) {
    const logLevel = 'warn'
    const type = 'ƒ-isValidCode'
    const message = `Skipping invalid code ${code}`

    tinyLogger.log(type, message, {
      logLevel,
      fileName: './log/log.csv',
    })
  }
  return isValid
}
