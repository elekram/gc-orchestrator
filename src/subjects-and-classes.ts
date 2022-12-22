import { csv } from './deps.ts'
import appSettings from '../config/config.ts'
import { Store } from './store.ts'
import { tinyLogger } from './deps.ts'

export interface Subject {
  name: string
  domain: string
  leaders: Set<string>
  teachers: Set<string>
}

export interface Class {
  subjectCode: string
  classCodeWithSemeterPrefix: string
  name: string
  domain: string
  leaders: Set<string>
  teachers: Set<string>
  students: Set<string>
}

interface Lesson {
  period: string
  teacher: string
  day: string
}

export interface Enrolments {
  teachers: Set<string>
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

const classNames = csv.parse(
  await Deno.readTextFile(`${csvFileLocation}${classNamesCsvFile}`),
  { skipFirstRow: true }
)

const timetable = csv.parse(
  await Deno.readTextFile(`${csvFileLocation}${timetableCsvFile}`),
  { skipFirstRow: true }
)

const studentLessons = csv.parse(
  await Deno.readTextFile(`${csvFileLocation}${studentLessonsCsvFile}`),
  { skipFirstRow: true }
)

const unscheduledDuties = csv.parse(
  await Deno.readTextFile(`${csvFileLocation}${unscheduledDutiesCsvFile}`),
  { skipFirstRow: true }
)

export function addTimetableToStore(store: Store) {
  const compositeClassCodes = getCompositeClassCodes(classExceptions)
  const subjects = addSubjectsAndClassesToStore(store, compositeClassCodes, subjectExceptions)
  const compositeClasses = addCompositeClassesToStore(store, classExceptions)

  return { subjects, compositeClasses }
}

function addCompositeClassesToStore(store: Store, classExceptions: string[]) {
  const uniqueLessons = getUniqueLessons(classExceptions)
  const compositeClasses = filterCompositeClasses(uniqueLessons, classExceptions)

  const assesmbledCompositeClasses: Map<string, Enrolments> = new Map()

  for (const [_key, c] of compositeClasses) {
    let compositeClassName = ''
    const sortedClasses: string[] = Array.from(c).sort()
    let teachers = new Set<string>()
    let students = new Set<string>()

    sortedClasses.forEach(c => {
      teachers = getTeachers(c)
      students = getStudents(c)

      compositeClassName += `${c.substring(1)}-`
    })
    compositeClassName = compositeClassName.slice(0, -1)

    const classMembers = {
      teachers,
      students
    }

    assesmbledCompositeClasses.set(compositeClassName, classMembers)
  }

  store.timetable.compositeClasses = assesmbledCompositeClasses
}

function getCompositeClassCodes(classExceptions: string[]): Set<string> {
  const uniqueLessons = getUniqueLessons(classExceptions)
  const compositeClasses = filterCompositeClasses(uniqueLessons, classExceptions)

  const compositeClassCodes: Set<string> = new Set()

  for (const [key, _c] of compositeClasses) {
    compositeClassCodes.add(key.substring(1))
  }

  return compositeClassCodes
}

function getUniqueLessons(classExceptions: string[]): Map<string, Lesson> {
  const lessons: Map<string, Lesson> = new Map()

  for (const row of timetable) {
    const classCode = row['Class Code'] as string

    if (!isValidCode(classCode)) {
      continue
    }

    const teacher = row['Teacher Code'] as string
    const period = row['Period No'] as string
    const day = row['Day No'] as string

    const exceptedClass: boolean = classExceptions.includes(classCode)

    if (!exceptedClass && !lessons.has(classCode)) {
      const lesson: Lesson = {
        period,
        teacher,
        day
      }
      lessons.set(classCode, lesson)
    }
  }
  return lessons
}

function filterCompositeClasses(uniqueLessons: Map<string, Lesson>,
  classExceptions: string[]): Map<string, Set<string>> {
  const compositeClasses: Map<string, Set<string>> = new Map()

  for (const [classCode, lesson] of uniqueLessons) {
    for (const row of timetable) {
      const exceptedClass: boolean = classExceptions.includes(row['Class Code'] as string)

      if (!exceptedClass) {
        if (
          classCode !== row['Class Code'] &&
          lesson.day === row['Day No'] &&
          lesson.period === row['Period No'] &&
          lesson.teacher === row['Teacher Code']
        ) {
          const classes: Set<string> = new Set()

          classes.add(classCode)
          classes.add(String(row['Class Code']))
          compositeClasses.set(classCode, classes)
        }
      }
    }
  }
  return compositeClasses
}

export function addSubjectsAndClassesToStore(
  store: Store,
  compositeClassCodes: Set<string>,
  subjectExceptions: string[]
): void {
  const subjects: Map<string, Subject> = new Map()
  const classes: Map<string, Class> = new Map()

  for (const row of classNames) {
    const subjectCodeWithSemeterPrefix = row['Subject Code'] as string
    const classCodeWithSemeterPrefix = row['Class Code'] as string

    if (!isValidCode(subjectCodeWithSemeterPrefix)) {
      continue
    }

    if (!isValidCode(classCodeWithSemeterPrefix)) {
      continue
    }

    const subjectCode = (row['Subject Code'] as string).substring(1)
    const classCode = (row['Class Code'] as string).substring(1)
    const name = (row['Subject Name'] as string).replace(/['"]+/g, '')
    const domain = (row['Faculty Name'] as string).split('_')[0].toUpperCase()
    const leaders = getLeaders(domain)
    const teachers = getTeachers(subjectCodeWithSemeterPrefix)
    const students = getStudents(classCodeWithSemeterPrefix)

    if (
      !subjects.has(subjectCode) &&
      !subjectExceptions.includes(subjectCode) &&
      !compositeClassCodes.has(classCode)
    ) {

      leaders?.forEach(leader => teachers.add(leader))

      const s: Subject = {
        name,
        domain,
        leaders: new Set<string>(leaders),
        teachers: new Set<string>(teachers),
      }

      const c: Class = {
        subjectCode,
        classCodeWithSemeterPrefix,
        name,
        domain,
        leaders: new Set<string>(leaders),
        teachers: new Set<string>(teachers),
        students: new Set<string>(students),
      }

      subjects.set(subjectCode, s)
      classes.set(classCode, c)
    }
  }

  store.timetable.subjects = subjects
  store.timetable.classes = classes
}

function getLeaders(domain: string): Set<string> | undefined {
  const domains: Map<string, Set<string>> = new Map()

  for (const row of unscheduledDuties) {
    const hasDomainLeaderRow: boolean = (row['Duty Name'] as string).includes('Google Domain Leader')

    if (hasDomainLeaderRow) {
      const domainName = (row['Duty Name'] as string).split('_')[1].toUpperCase()
      const domainLeader = (row['Teacher Code'] as string).toLowerCase()
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
    if (row['Class Code'] === classCode) {
      const student = row['Student Code'] as string

      if (student) {
        const username = student + gooogleDomain
        students.add(username.toLowerCase())
      }
    }
  }
  return students
}

function getTeachers(code: string): Set<string> {
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
      fileName: './log/log.csv'
    })
  }
  return isValid
}
