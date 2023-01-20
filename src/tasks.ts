import { Store } from './store.ts'
import * as googleClassroom from './google-actions.ts'
import { Enrolments } from './subjects-and-classes.ts'
import { diffArrays } from './diff-arrays.ts'
import appSettings from '../config/config.ts'

export interface CourseTask {
  type: 'create' |
  'update' |
  'archive'
  props: {
    updateMask: string
    requestBody: {
      id: string
      ownerId: string
      name: string
      section: string
      description: string
      descriptionHeading: string,
      courseState: string
    }
  }
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

    const course = {
      id: alias,
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
        props: {
          updateMask: '',
          requestBody: course
        }
      })
    }

    store.tasks.courseUpdateTasks.push({
      type: 'update',
      props: {
        updateMask: 'name,section,description,descriptionHeading,courseState',
        requestBody: course
      }
    })
  }
}

// deno-lint-ignore require-await
export async function addSubjectTasksToStore(store: Store) {
  for (const [subjectCode, s] of store.timetable.subjects) {
    const alias = `SUBJ-${subjectCode}`
    const course = {
      id: alias,
      ownerId: appSettings.classadmin,
      name: `${subjectCode} (Teachers)`,
      section: s.name,
      description: `Domain: ${s.domain} - ${s.name} (Teacher Planning Classroom)`,
      descriptionHeading: `Subject Domain: ${s.domain}`,
      courseState: 'ACTIVE'
    }

    if (!store.remote.courseAliases.has(alias)) {
      store.tasks.courseCreationTasks.push({
        type: 'create',
        props: {
          updateMask: '',
          requestBody: course
        }
      })
    }

    store.tasks.courseUpdateTasks.push({
      type: 'update',
      props: {
        updateMask: 'name,section,description,descriptionHeading,courseState',
        requestBody: course
      }
    })
  }
}

// deno-lint-ignore require-await
export async function addClassTasksToStore(store: Store) {
  for (const [classCode, c] of store.timetable.classes) {

    const academicYear = getAcademicYearForClasscode(classCode)
    const alias = `${academicYear}-${classCode}`

    const course = {
      id: alias,
      ownerId: appSettings.classadmin,
      name: c.classCodeWithSemeterPrefix,
      section: c.name,
      description: `Domain: ${c.domain} - ${c.name} (${c.classCodeWithSemeterPrefix})`,
      descriptionHeading: `Subject Domain: ${c.domain}`,
      courseState: 'ACTIVE'
    }

    if (!store.remote.courseAliases.has(alias)) {
      store.tasks.courseCreationTasks.push({
        type: 'create',
        props: {
          updateMask: '',
          requestBody: course
        }
      })
    }

    store.tasks.courseUpdateTasks.push({
      type: 'update',
      props: {
        updateMask: 'name,section,description,descriptionHeading,courseState',
        requestBody: course
      }
    })
  }

}

export async function addStudentEnrolmentTasksToStore(store: Store) {
  const auth = store.auth
  let timetabledClasses: TimetabledClass[] = []

  const compositeClassEnrollments = getEnrolmentsForClass(
    store,
    'students',
    store.timetable.compositeClasses
  )

  const classEnrollments = getEnrolmentsForClass(
    store,
    'students',
    store.timetable.classes
  )

  if (compositeClassEnrollments.length) {
    timetabledClasses = timetabledClasses.concat(compositeClassEnrollments)
  }

  if (classEnrollments.length) {
    timetabledClasses = timetabledClasses.concat(classEnrollments)
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
                courseId: remoteCourse.courseId as string,
                user: {
                  userId: student
                }
              } as googleClassroom.CourseMemberProps)
            }

            const studentsToRemove = diffedStudents.arr2Diff
            for (const student of studentsToRemove) {
              store.tasks.enrolmentTasks.push({
                type: 'students',
                action: 'DELETE',
                courseId: remoteCourse.courseId as string,
                user: {
                  userId: student
                }
              } as googleClassroom.CourseMemberProps)
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
                courseId: remoteCourse.courseId as string,
                user: {
                  userId: teacher
                }
              } as googleClassroom.CourseMemberProps)
            }

            const teachersToRemove = diffedTeachers.arr2Diff
            for (const teacher of teachersToRemove) {

              if (teacher.toLowerCase() === appSettings.classadmin) {
                continue
              }

              if (appSettings.teacherAides.includes(teacher.toLowerCase())) {
                continue
              }

              store.tasks.enrolmentTasks.push({
                type: 'teachers',
                action: 'DELETE',
                courseId: remoteCourse.courseId as string,
                user: {
                  userId: teacher
                }
              } as googleClassroom.CourseMemberProps)
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
    const id = store.remote.courseAliases.get(alias)

    if (!id) {
      throw 'addCourseArchiveTasksToStore(): Id Not found'
    }

    const course = store.remote.courses.get(id) as {
      name: string,
      section: string,
      descriptionHeading: string,
      description: string
    }

    const props = {
      updateMask: 'name,section,description,descriptionHeading,courseState',
      requestBody: {
        id: alias,
        name: course.name,
        section: course.section,
        description: course.description,
        descriptionHeading: course.descriptionHeading,
        courseState: 'ARCHIVED',
        ownerId: appSettings.classadmin
      }
    }

    if (store.remote.courseAliases.has(alias)) {
      store.tasks.courseArchiveTasks.push({
        type: 'archive',
        props
      })
    }
  }
}

// deno-lint-ignore require-await
export async function addCourseDeletionTasksToStore(store: Store) {
  const currentAcademicCourseYears = getCurrentAcademicYearSet()
  const yearValues: number[] = []
  appSettings.academicYearMap.forEach(year => {
    yearValues.push(parseInt(year))
  })

  const lowestRelevantCourseYear = (Math.min(...yearValues) - 1)

  for (const [courseAlias, _id] of store.remote.courseAliases) {

    const aliasPrefix = courseAlias.substring(0, 4)

    if (aliasPrefix === 'SUBJ') {
      continue
    }

    if (!currentAcademicCourseYears.has(aliasPrefix)) {
      if (parseInt(aliasPrefix) < lowestRelevantCourseYear) {
        store.tasks.courseDeletionTasks.push(courseAlias)
      }
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

function getCurrentAcademicYearSet() {
  const releventYears = new Set()
  for (const [_yearlevel, year] of appSettings.academicYearMap) {
    releventYears.add(year)
  }
  return releventYears
}

function getAcademicYearForClasscode(classCode: string) {

  const decimalChars = /\d+/g
  const matchedDecimalsArray = [...classCode.matchAll(decimalChars)];

  const decimalsArray = matchedDecimalsArray.flat()
  let releventYear = ''

  if (decimalsArray.length === 1) {
    const yearLevel = decimalsArray[0].slice(0, 2)
    const year = appSettings.academicYearMap.get(yearLevel)

    if (typeof year === 'string') {
      releventYear = year
    }
  }

  if (decimalsArray.length === 2) {
    const yearLevel = decimalsArray[1].slice(0, 2)
    const year = appSettings.academicYearMap.get(yearLevel)

    if (typeof year === 'string') {
      releventYear = year
    }
  }

  if (!releventYear) {
    throw `Error: getAcademicYearForClasscode(classCode: ${classCode}) -> Year level code undefined`
  }

  return releventYear
}