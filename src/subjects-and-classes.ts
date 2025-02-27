import { parse } from 'std/csv/mod.ts'
import appSettings from '../config/config.ts'
import { Store } from './store.ts'
import { tinyLogger } from './deps.ts'

export interface Class {
  subjectCode: string
  classCodeWithSemeterPrefix: string
  name: string
  domain: string
  domainCode: string
  subjectLeaders: Set<string>
  subjectTeachers: Set<string>
  classTeachers: Set<string>
  subjectStudents: Set<string>
  students: Set<string>
  schedule: Map<number, Set<number>>
  rotations: Set<string>
  hasSchedule: boolean
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
  domainCode: string
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

if (classNames.length <= 1) {
  console.log("\n%c[ Fatal: class-details CSV is empty. Script must exit ]\n", 'color:red')
  Deno.exit()
}

const timetable = parse(
  await Deno.readTextFile(`${csvFileLocation}${timetableCsvFile}`),
  { skipFirstRow: true },
)

if (timetable.length <= 1) {
  console.log("\n%c[ Fatal: Timetable-Quilt CSV is empty. Script must exit ]\n", 'color:red')
  Deno.exit()
}

const studentLessons = parse(
  await Deno.readTextFile(`${csvFileLocation}${studentLessonsCsvFile}`),
  { skipFirstRow: true },
)

if (studentLessons.length <= 1) {
  console.log("\n%c[ Fatal: Student Allocations CSV is empty. Script must exit ]\n", 'color:red')
  Deno.exit()
}

const unscheduledDuties = parse(
  await Deno.readTextFile(`${csvFileLocation}${unscheduledDutiesCsvFile}`),
  { skipFirstRow: true },
)

if (unscheduledDuties.length <= 1) {
  console.log("\n%c[ Fatal: Teacher Responsibilities CSV is empty. Script must exit ]\n", 'color:red')
  Deno.exit()
}

export function addTimetableToStore(store: Store) {
  // const yearLevelClasses = getYearLevelClasses()
  const compositeClassCodes = getCompositeClasses(classExceptions).classCodes()

  const timetable = getSubjectsAndClasses(
    compositeClassCodes,
    subjectExceptions,
  )

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


// function getYearLevelClasses() {
//   const yearLevels: string[] = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12"]
//   const yearLevelClasses: Map<string, Class> = new Map()


//   for (const y of yearLevels) {
//     const yearLevel = y.split(" ")[1]

//     const c: Class = {
//       subjectCode: yearLevel + "STUDENTS",
//       domain: "N/A",
//       domainCode: "N/A",
//       name: y + " Students",
//       classCodeWithSemeterPrefix: yearLevel + "STUDENTS",
//       students: new Set<string>(),
//       subjectTeachers: new Set<string>(),
//       subjectLeaders: new Set<string>(),
//       classTeachers: new Set<string>(),
//       subjectStudents: new Set<string>(),
//       schedule: new Map<number, Set<number>>(),
//       isComposite: false,
//       isExceptedSubject: false,
//     }
//     for (const row of studentLessons) {
//       if (row["Class Year Level"] !== yearLevel) continue
//       if (row["Student Code"] === "") continue
//       if (row["Student Code"] === "-") continue
//       if (!row["Student Code"]) continue

//       c.students.add(row["Student Code"].toLowerCase() + appSettings.domain)
//     }


//     for (const row of timetable) {
//       if (row["Curriculum"] !== yearLevel) continue
//       if (row["Teacher Code"] === "") continue
//       if (row["Teacher Code"] === "-") continue
//       if (!row["Teacher Code"]) continue

//       c.subjectTeachers.add(row["Teacher Code"].toLowerCase() + appSettings.domain)

//     }
//     yearLevelClasses.set(y, c)
//   }

//   return yearLevelClasses
// }

function getCompositeClasses(classExceptions: string[]) {
  const teacherSchedules: Map<string, Set<string>> = new Map()
  const compositeClassCodes: Set<string> = new Set()

  for (const row of timetable) {
    if (!row['Rotation'] || row['Rotation'] === "" || row['Rotation'] === "-") {
      continue
    }

    if (row['Rotation'].toUpperCase() !== appSettings.griddleRotation.toUpperCase()) {
      continue
    }

    if (!row['Day Number'] || row['Day Number'] === "" || row['Day Number'] === "-") {
      continue
    }

    if (!row['Period Code'] || row['Period Code'] === "" || row['Period Code'] === "-") {
      continue
    }

    if (!row['Teacher Code'] || row['Teacher Code'] === "" || row['Teacher Code'] === "-") {
      continue
    }

    if (!row['Class Code'] || row['Class Code'] === "" || row['Class Code'] === "-") {
      continue
    }

    const schedule = `D${row['Day Number']}P${row['Period Code']}${row['Teacher Code']}`

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

    const sanitisedClasses: string[] = []
    for (const c of classes[1]) {
      const yearLevel = c.substring(0, 2)

      if (isNumeric(yearLevel)) {
        sanitisedClasses.push(c)
      }

      if (!isNumeric(yearLevel)) {
        sanitisedClasses.push("0" + c)
      }
    }

    const preSortedClassCodes = [...(sanitisedClasses)].sort()
    const sortedClassCodes: string[] = []

    for (const c of preSortedClassCodes) {
      if (c.substring(0, 2) === "01") {
        sortedClassCodes.push(c)
        continue
      }
      if (c.substring(0, 1) == "0") {
        sortedClassCodes.push(c.substring(1))
        continue
      }

      sortedClassCodes.push(c)
    }

    let compositeClassName = ''
    let subjectCode = ''
    let domain = ''
    let domainCode = ''
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
      // console.log(classCode)
      // console.log(c)
      if (!c[0]) {
        continue
      }

      if (c[0]['Course Code']) {
        subjectCode = c[0]['Course Code']
      }

      if (c[0]['Faculty Name']) {
        domain = c[0]['Faculty Name']
      }

      if (c[0]['Faculty Code']) {
        domainCode = c[0]['Faculty Code'].toUpperCase()
      }

      if (c[0]['Course Name']) {
        subjectNames.add(
          c[0]['Course Name'].replace(/['"]+/g, ''),
        )
      }

      // if (!isValidCode(subjectCode)) {
      //   continue
      // }

      // if (!isValidCode(classCode)) {
      //   continue
      // }

      if (!classExceptions.includes(classCode)) {
        compositeClassCodes.add(classCode.substring(1))
      }

      classCodes.add(classCode)
      classCodesWithSemeterPrefix.add(classCode)
      compositeClassName += `${classCode}-`

      const leaders = getLeaders(domainCode)
      const teachersFromSubjectCode = getSubjectTeachers(
        subjectCode,
        domainCode,
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
      subjectLeaders: new Set(getLeaders(domainCode)),
      subjectTeachers: new Set(subjectTeachers),
      classTeachers: new Set(classTeachers),
      domain,
      domainCode,
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

function isNumeric(str: string) {
  if (typeof str != "string") return false // we only process strings!  
  return !isNaN(Number(str)) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

function getTimetableRotation(classCode: string) {
  const rotations: string[] = []

  for (const row of timetable) {
    if (row['Class Code'] !== classCode) continue
    if (!row['Rotation']) continue
    if (row['Rotation'] === '') continue
    if (row['Rotation'] === '-') continue

    rotations.push(row['Rotation'].toUpperCase())
  }
  return rotations
}

export function getSubjectsAndClasses(
  compositeClassCodes: Set<string>,
  subjectExceptions: string[],
) {
  const classes: Map<string, Class> = new Map()
  const subjects = new Set<string>()

  for (const row of classNames) {

    const subjectCodeWithSemeterPrefix = row['Course Code'] as string
    const classCodeWithSemeterPrefix = row['Class Code'] as string

    const subjectCode = subjectCodeWithSemeterPrefix
    if (!subjectCode || subjectCode === "" || subjectCode == "-") {
      continue
    }
    const classCode = classCodeWithSemeterPrefix
    if (!classCode || classCode === "" || classCode == "-") {
      continue
    }

    const name = (row['Course Name'] as string).replace(/['"]+/g, '')

    if (!name || name === "" || name === "-") {
      continue
    }

    const domain = (row['Faculty Name'] as string)
    const domainCode = (row['Faculty Code'] as string).toUpperCase().trim()
    const leaders = getLeaders(domainCode)
    const subjectTeachers = getSubjectTeachers(
      subjectCodeWithSemeterPrefix,
      domainCode,
      subjectAdmins,
    )
    const classTeachers = getClassTeachers(classCodeWithSemeterPrefix)
    const subjectStudents = getSubjectStudents(subjectCodeWithSemeterPrefix)
    const students = getStudents(classCodeWithSemeterPrefix)

    subjects.add(subjectCode)

    leaders?.forEach((leader) => subjectTeachers.add(leader))
    const schedule = getPeriodSchedule(classCodeWithSemeterPrefix)

    let hasSchedule = false
    if (schedule.size) {
      for (const s of schedule) {
        if (s[1].size) {
          hasSchedule = true
        }
      }
    }

    let isExceptedSubject = false
    if (subjectExceptions.includes(subjectCode)) {
      isExceptedSubject = true
    }

    let isComposite = false
    if (compositeClassCodes.has(classCode)) {
      isComposite = true
    }

    const c: Class = {
      subjectCode,
      classCodeWithSemeterPrefix,
      name,
      domain,
      domainCode,
      subjectLeaders: new Set<string>(leaders),
      subjectTeachers: new Set<string>(subjectTeachers),
      classTeachers: new Set<string>(classTeachers),
      subjectStudents: new Set<string>(subjectStudents),
      students: new Set<string>(students),
      schedule,
      hasSchedule,
      rotations: new Set<string>(getTimetableRotation(classCode)),
      isComposite: isComposite,
      isExceptedSubject,
    }

    classes.set(`${subjectCode}.${classCode}`, c)
  }

  return { classes, subjects }
}

function getClassTeachers(classCodeWithSemeterPrefix: string) {
  const classTeachers: Set<string> = new Set()

  for (const row of timetable) {
    if (row['Class Code'] === classCodeWithSemeterPrefix) {
      if (!row['Teacher Code']) continue

      if (row['Teacher Code'] === "" || row['Teacher Code'] === "-") {
        continue
      }

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

    const dayNumber = Number(row['Day Number'])
    const periodNumber = Number(row['Period Code'])

    if (periodSchedule.has(dayNumber)) {
      periodSchedule.get(dayNumber)?.add(periodNumber)
      continue
    }

    if (!isNaN(dayNumber)) {
      periodSchedule.set(dayNumber, new Set<number>())

      if (!isNaN(periodNumber)) {
        periodSchedule.get(dayNumber)?.add(periodNumber)
      }
    }
  }
  return periodSchedule
}

function getLeaders(domain: string): Set<string> | undefined {
  const domains: Map<string, Set<string>> = new Map()

  for (const row of unscheduledDuties) {
    const hasDomainLeaderRow: boolean = (row['Responsibility'] as string).includes(
      'Google Classroom',
    )

    if (hasDomainLeaderRow) {
      const domainName = (row['Responsibility'] as string).split('-')[1]
        .toUpperCase().trim()
      const domainLeader = (row['Code'] as string).toLowerCase()
      if (domainLeader == "" || domainLeader == "-") {
        continue
      }
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
        if (student === "" || student === "-") {
          continue
        }
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
        if (teacher === "" || teacher === "-") {
          continue
        }

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
