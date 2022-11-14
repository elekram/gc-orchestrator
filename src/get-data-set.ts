import { csv } from './deps.ts'
import appSettings from '../config/config.ts'

interface DataSet {
  subjects: Map<string, Subject>
  compositeClasses: Map<string, CompositeClass>
}

export interface Subject {
  name: string
  domain: string
  leaders: Set<string>
  teachers: Set<string>
  classes: Map<string, Set<string>>
}

interface Lesson {
  period: string
  teacher: string
  day: string
}

interface CompositeClass {
  teachers: Set<string>
  students: Set<string>
}

const gooogleDomain = String(appSettings.domain)
const csvFileLocation = appSettings.timetableFiles
const subjectExceptions = appSettings.subjectExceptions
const classExceptions = appSettings.compositeClassExceptions

const classNamesCsv = csv.parse(
  await Deno.readTextFile(`${csvFileLocation}/Class Names.csv`),
  { skipFirstRow: true }
)

const timetableCsv = csv.parse(
  await Deno.readTextFile(`${csvFileLocation}/Timetable.csv`),
  { skipFirstRow: true }
)

const studentLessonsCsv = csv.parse(
  await Deno.readTextFile(`${csvFileLocation}/Student Lessons.csv`),
  { skipFirstRow: true }
)

const unscheduledDuties = csv.parse(
  await Deno.readTextFile(`${csvFileLocation}/Unscheduled Duties.csv`),
  { skipFirstRow: true }
)

export default function getDataSet(): DataSet {
  const dataset: DataSet = {
    subjects: new Map(),
    compositeClasses: new Map()
  }

  const compositeClassCodes = getCompositeClassCodes(classExceptions)

  dataset.subjects = getSubjects(compositeClassCodes, subjectExceptions)
  dataset.compositeClasses = getCompositeClasses(classExceptions)

  return dataset
}

function getCompositeClasses(classExceptions: string[]) {
  const uniqueLessons = getUniqueLessons(classExceptions)
  const compositeClasses = filterCompositeClasses(uniqueLessons, classExceptions)

  const assesmbledCompositeClasses: Map<string, CompositeClass> = new Map()

  for (const [_key, c] of compositeClasses) {
    let compositeClassName = ''
    const sortedClasses: string[] = Array.from(c).sort()
    const teachers = new Set<string>()
    let students = new Set<string>()

    sortedClasses.forEach(c => {
      teachers.add(getTeacher(c))
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

  return assesmbledCompositeClasses
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
  for (const row of timetableCsv) {
    const classCode = String(row['Class Code'])

    const exceptedClass: boolean = classExceptions.includes(classCode)

    if (!exceptedClass && !lessons.has(classCode)) {
      const lesson: Lesson = {
        period: String(row['Period No']),
        teacher: String(row['Teacher Code']),
        day: String(row['Day No'])
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
    for (const row of timetableCsv) {
      const exceptedClass: boolean = classExceptions.includes(String(row['Class Code']))

      if (!exceptedClass) {
        if (classCode !== String(row['Class Code']) &&
          lesson.day === String(row['Day No']) &&
          lesson.period === String(row['Period No']) &&
          lesson.teacher === String(row['Teacher Code'])) {

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

function getSubjects(compositeClassCodes: Set<string>, subjectExceptions: string[]): Map<string, Subject> {
  const subjects: Map<string, Subject> = new Map()

  classNamesCsv.forEach((row) => {
    const name = String(row['Subject Name']).replace(/['"]+/g, '')
    const subjectCode = String(row['Subject Code']).substring(1)
    const classCode = String(row['Class Code']).substring(1)
    const classCodeWithSemeterPrefix = String(row['Class Code'])
    const domain = String(row['Faculty Name']).split('_')[0].toUpperCase()
    const leaders = getLeaders(domain)
    const teacher = getTeacher(classCodeWithSemeterPrefix)
    const students = getStudents(classCodeWithSemeterPrefix)

    if (!subjects.has(subjectCode) && !subjectExceptions.includes(subjectCode)) {
      const subject = {
        name,
        domain,
        leaders: new Set<string>(leaders),
        teachers: new Set<string>(leaders),
        classes: new Map<string, Set<string>>()
      }

      if (!compositeClassCodes.has(classCode)) {
        subject.classes.set(classCode, new Set<string>(students))
      }

      if (teacher) {
        subject.teachers.add(teacher)
      }

      subjects.set(subjectCode, subject)
    } else {
      if (!compositeClassCodes.has(classCodeWithSemeterPrefix)) {
        subjects.get(subjectCode)?.classes.set(classCode, new Set<string>(students))
      }

      if (teacher) {
        subjects.get(subjectCode)?.teachers.add(teacher)
      }
    }
  })
  return subjects
}

function getLeaders(domain: string): Set<string> | undefined {
  const domains: Map<string, Set<string>> = new Map()

  unscheduledDuties.forEach((row): void => {
    const isDomainLeaderRowInCSV: boolean = String(row['Duty Name']).includes('Domain Leader')

    if (isDomainLeaderRowInCSV) {
      const domainName = String(row['Duty Name']).split('_')[1].toUpperCase()
      const domainLeader = String(row['Teacher Code']).toLowerCase()
      const username = domainLeader + gooogleDomain

      if (!domains.has(domainName)) {
        domains.set(domainName, new Set())
      }
      domains.get(domainName)?.add(username)
    }
  })

  return domains.get(domain)
}

function getStudents(classCode: string): Set<string> {
  const students = new Set<string>()

  studentLessonsCsv.forEach((row) => {
    if (row['Class Code'] === classCode) {
      const student = String(row['Student Code']).toLowerCase()
      if (student) {
        const username = student + gooogleDomain
        students.add(username)
      }
    }
  })
  return students
}

function getTeacher(classCode: string): string {
  let username = ''

  timetableCsv.forEach((row) => {
    if (classCode === String(row['Class Code'])) {
      const teacher = String(row['Teacher Code']).toLowerCase()
      if (teacher) {
        username = teacher + gooogleDomain
      }
    }
  })

  return username
}