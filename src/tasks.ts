import { Store } from './store.ts'
import * as googleClassroom from './google-actions.ts'
import { Enrolments } from './subjects-and-classes.ts'
import appSettings from '../config/config.ts'

export interface CourseTask {
  type: 'create' |
  'update' |
  'archive'
  attributes: {
    id: string
    ownerId?: string
    name?: string
    section?: string
    description?: string
    descriptionHeading?: string,
    courseState?: string
  }
}

export interface EnrolmentTask {
  type: 'students' | 'teachers'
  action: 'POST' | 'DELETE'
  id: string
  student?: string
  teacher?: string
}

type TimetabledClass = {
  classCode: string, students: string[]
} | { classCode: string, teachers: string[] }

// deno-lint-ignore require-await
export async function addCompositeClassTasksToStore(store: Store) {
  for (const [classCode, _c] of store.timetable.compositeClasses) {
    const academicYear = getAcademicYearForClasscode(classCode)
    const alias = `${academicYear}-${classCode}`
    const name = `${classCode} (Composite)`
    const description = `Composite Class (${classCode})`

    const attributes = {
      id: `d:${alias}`,
      ownerId: appSettings.classadmin,
      name,
      section: name,
      description,
      descriptionHeading: description,
      courseState: 'ACTIVE'
    }

    if (!store.remote.courseAliases.has(alias)) {
      store.tasks.courseCreationTasks.push({
        type: 'create',
        attributes
      })
    }

    store.tasks.courseUpdateTasks.push({
      type: 'update',
      attributes
    })
  }
}

// deno-lint-ignore require-await
export async function addSubjectTasksToStore(store: Store) {
  for (const [subjectCode, s] of store.timetable.subjects) {
    const alias = `SUBJ-${subjectCode}`
    const attributes = {
      id: `d:${alias}`,
      ownerId: appSettings.classadmin,
      name: `${subjectCode} (Teachers)`,
      section: s.name,
      description: `Domain: ${s.domain} - ${s.name} (Teachers)`,
      descriptionHeading: `Subject Domain: ${s.domain}`,
      courseState: 'ACTIVE'
    }

    if (!store.remote.courseAliases.has(alias)) {
      store.tasks.courseCreationTasks.push({
        type: 'create',
        attributes
      })
    }

    store.tasks.courseUpdateTasks.push({
      type: 'update',
      attributes
    })
  }
}

// deno-lint-ignore require-await
export async function addClassTasksToStore(store: Store) {
  for (const [classCode, c] of store.timetable.classes) {

    const academicYear = getAcademicYearForClasscode(classCode)
    const alias = `${academicYear}-${classCode}`

    const attributes = {
      id: `d:${alias}`,
      ownerId: appSettings.classadmin,
      name: c.name,
      section: c.name,
      description: `Domain: ${c.domain} - ${c.name}`,
      descriptionHeading: `Subject Domain: ${c.domain}`,
      courseState: 'ACTIVE'
    }

    if (!store.remote.courseAliases.has(alias)) {
      store.tasks.courseCreationTasks.push({
        type: 'create',
        attributes
      })
    }

    store.tasks.courseUpdateTasks.push({
      type: 'update',
      attributes
    })
  }

}

export async function addStudentEnrolmentTasksToStore(store: Store) {
  const auth = store.auth
  let timetabledClasses: TimetabledClass[] = []

  const compositeEnrollments = getEnrolmentsForClass(
    store,
    'students',
    store.timetable.compositeClasses
  )

  timetabledClasses = timetabledClasses.concat(compositeEnrollments)

  const enrollments = getEnrolmentsForClass(
    store,
    'students',
    store.timetable.classes
  )

  if (enrollments.length) {
    timetabledClasses = timetabledClasses.concat(enrollments)
  }

  const remoteCourseEnrolments = await Promise.all(
    timetabledClasses.map(async (ttClass, index) => {

      const academicYear = getAcademicYearForClasscode(ttClass.classCode)
      const alias = `${academicYear}-${ttClass.classCode}`

      return await googleClassroom.listCourseMembers(
        auth,
        'students',
        alias,
        index,
        timetabledClasses.length
      )
    })
  )

  for (const tc of timetabledClasses) {
    const academicYear = getAcademicYearForClasscode(tc.classCode)
    const alias = `${academicYear}-${tc.classCode}`

    if ('students' in tc) {

      const students = tc.students
      const hasRemoteCourse = remoteCourseEnrolments.filter(match => {
        if (match) {
          return match.courseId === alias
        }
      })

      if (hasRemoteCourse.length) {
        for (const remoteCourse of remoteCourseEnrolments) {

          if (remoteCourse.courseId === alias) {
            const diffedStudents = diffArrays(
              students,
              remoteCourse.students as string[]
            )

            const studentsToAdd = diffedStudents.arr1Diff
            for (const student of studentsToAdd) {
              store.tasks.enrolmentTasks.push({
                type: 'students',
                action: 'POST',
                id: remoteCourse.courseId as string,
                student
              })
            }

            const studentsToRemove = diffedStudents.arr2Diff
            for (const student of studentsToRemove) {
              store.tasks.enrolmentTasks.push({
                type: 'students',
                action: 'DELETE',
                id: remoteCourse.courseId as string,
                student
              })
            }
          }
        }
      }
    }
  }
}

export async function addTeacherEnrolmentTasksToStore(store: Store) {
  const auth = store.auth
  let timetabledClasses: TimetabledClass[] = []

  const compositeEnrollments = getEnrolmentsForClass(
    store,
    'teachers',
    store.timetable.compositeClasses
  )

  timetabledClasses = timetabledClasses.concat(compositeEnrollments)

  const enrollments = getEnrolmentsForClass(
    store,
    'teachers',
    store.timetable.classes
  )

  if (enrollments.length) {
    timetabledClasses = timetabledClasses.concat(enrollments)
  }

  const remoteCourseEnrolments = await Promise.all(
    timetabledClasses.map(async (ttClass, index) => {
      const academicYear = getAcademicYearForClasscode(ttClass.classCode)
      const alias = `${academicYear}-${ttClass.classCode}`

      return await googleClassroom.listCourseMembers(
        auth,
        'teachers',
        alias,
        index,
        timetabledClasses.length
      )
    })
  )

  for (const tc of timetabledClasses) {
    const academicYear = getAcademicYearForClasscode(tc.classCode)
    const alias = `${academicYear}-${tc.classCode}`

    if ('teachers' in tc) {

      const teachers = tc.teachers
      const hasRemoteCourse = remoteCourseEnrolments.filter(match => {
        if (match) {
          return match.courseId === alias
        }
      })

      if (hasRemoteCourse.length) {
        for (const remoteCourse of remoteCourseEnrolments) {

          if (remoteCourse.courseId === alias) {
            const diffedTeachers = diffArrays(
              teachers,
              remoteCourse.teachers as string[]
            )

            const teachersToAdd = diffedTeachers.arr1Diff
            for (const teacher of teachersToAdd) {
              store.tasks.enrolmentTasks.push({
                type: 'teachers',
                action: 'POST',
                id: remoteCourse.courseId as string,
                teacher
              })
            }

            const teachersToRemove = diffedTeachers.arr2Diff
            for (const teacher of teachersToRemove) {

              if (teacher.toLowerCase() === appSettings.classadmin) {
                continue
              }

              if (appSettings.teacherAides.includes(teacher.toLocaleLowerCase())) {
                continue
              }

              store.tasks.enrolmentTasks.push({
                type: 'teachers',
                action: 'DELETE',
                id: remoteCourse.courseId as string,
                teacher
              })
            }
          }
        }
      }
    }

  }
}

// deno-lint-ignore require-await
export async function addCourseArchiveTasksToStore(store: Store) {

  const remoteCourseCandidates = []

  for (const [courseAlias, id] of store.remote.courseAliases) {
    const aliasPrefix = courseAlias.substring(0, 4)
    const currentAcademicCourseYears = getCurrentAcademicYearSet()

    if (aliasPrefix === 'SUBJ') {
      continue
    }

    if (!currentAcademicCourseYears.has(aliasPrefix)) {
      const course = store.remote.courses.get(id) as { name: string, courseState: string }

      if (course.courseState.toLowerCase() === 'active') {
        remoteCourseCandidates.push(courseAlias)
      }

    }
  }

  const currentTimetabledClasses = []
  for (const [classCode, _c] of store.timetable.classes) {
    const academicYear = getAcademicYearForClasscode(classCode)
    currentTimetabledClasses.push(`${academicYear}-${classCode}`)

  }

  for (const [classCode, _c] of store.timetable.compositeClasses) {
    const academicYear = getAcademicYearForClasscode(classCode)
    currentTimetabledClasses.push(`${academicYear}-${classCode}`)
  }

  const diffedCourses = diffArrays(currentTimetabledClasses, remoteCourseCandidates)

  for (const alias of diffedCourses.arr2Diff) {

    const attributes = {
      id: alias,
      courseState: 'ARCHIVED'
    }

    if (store.remote.courseAliases.has(alias)) {
      store.tasks.courseArchiveTasks.push({
        type: 'archive',
        attributes
      })
    }
  }
}

function getEnrolmentsForClass(
  store: Store,
  type: 'students' | 'teachers',
  classes: Map<string, Enrolments>
) {
  const timetabledClasses = []

  for (const [classCode, c] of classes) {
    const academicYear = getAcademicYearForClasscode(classCode)
    const alias = `${academicYear}-${classCode}`
    const members = Array.from(c[type])

    if (store.remote.courseAliases.has(alias)) {
      timetabledClasses.push({
        classCode,
        [type]: members
      } as TimetabledClass)
    }
  }
  return timetabledClasses
}

function diffArrays(arr1: string[], arr2: string[]) {
  const arr1Diff = arr1.filter(item => !arr2.includes(item))
  const arr2Diff = arr2.filter(item => !arr1.includes(item))

  return {
    arr1Diff,
    arr2Diff
  }
}

function getCurrentAcademicYearSet() {
  const relaventYears = new Set()
  for (const [_yearlevel, year] of appSettings.academicYearMap) {
    relaventYears.add(year)
  }
  return relaventYears
}

function getAcademicYearForClasscode(classCode: string) {

  const decimalChars = /\d+/g
  const matchedDecimalsArray = [...classCode.matchAll(decimalChars)];

  const decimalsArray = matchedDecimalsArray.flat()
  let relaventYear = ''

  if (decimalsArray.length === 1) {
    const yearLevel = decimalsArray[0].slice(0, 2)
    const year = appSettings.academicYearMap.get(yearLevel)

    if (typeof year === 'string') {
      relaventYear = year
    }
  }

  if (decimalsArray.length === 2) {
    const yearLevel = decimalsArray[1].slice(0, 2)
    const year = appSettings.academicYearMap.get(yearLevel)

    if (typeof year === 'string') {
      relaventYear = year
    }
  }

  if (!relaventYear) {
    throw `Error: getAcademicYearForClasscode(classCode: ${classCode}) -> Year level code undefined`
  }

  return relaventYear
}