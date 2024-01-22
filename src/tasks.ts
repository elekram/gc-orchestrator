import { Store } from './store.ts'
import * as googleClassroom from './google-actions.ts'
import { Enrolments } from './subjects-and-classes.ts'
import { diffArrays } from './diff-arrays.ts'
import appSettings from '../config/config.ts'

export interface CourseTask {
  type:
    | 'create'
    | 'update'
    | 'archive'
  props: {
    updateMask: string
    requestBody: {
      id: string
      ownerId: string
      name: string
      section: string
      description: string
      descriptionHeading: string
      courseState: string
    }
  }
}

export type TimetabledCourse = {
  courseCode: string
  students: string[]
} | { courseCode: string; teachers: string[] }

// deno-lint-ignore require-await
export async function addCompositeClassTasksToStore(store: Store) {
  for (const [classCode, c] of store.timetable.compositeClasses) {
    const academicYear = getAcademicYearForClasscode(classCode)
    const alias = `${academicYear}-${classCode}`
    const name = `${classCode} | ${academicYear}`

    let section = ''
    for (const subjectName of c.subjectNames) {
      section += `${subjectName} AND `
    }

    const trimmedSectionName = section.slice(0, -4)

    const description =
      `Academic Year: ${academicYear} Domain: ${c.domain} Composite: ${trimmedSectionName}`

    const course = {
      id: alias,
      ownerId: appSettings.classadmin,
      name,
      section: trimmedSectionName,
      description,
      descriptionHeading: description,
      courseState: 'ACTIVE',
    }

    if (!store.remote.courseAliases.has(alias)) {
      store.tasks.courseCreationTasks.push({
        type: 'create',
        props: {
          updateMask: '',
          requestBody: course,
        },
      })
    }

    store.tasks.courseUpdateTasks.push({
      type: 'update',
      props: {
        updateMask: 'name,section,description,descriptionHeading,courseState',
        requestBody: course,
      },
    })
  }
}

// deno-lint-ignore require-await
export async function addSubjectTasksToStore(store: Store) {
  for (const [subjectCode, s] of store.timetable.subjects) {
    if (s.isExceptedSubject) continue

    const alias = `SUBJ-${subjectCode}`
    const course = {
      id: alias,
      ownerId: appSettings.classadmin,
      name: `${subjectCode} (Teachers)`,
      section: s.name,
      description: `Domain: ${s.domain} - ${s.name} (Teacher Planning Classroom)`,
      descriptionHeading: `Subject Domain: ${s.domain}`,
      courseState: 'ACTIVE',
    }

    if (!store.remote.courseAliases.has(alias)) {
      store.tasks.courseCreationTasks.push({
        type: 'create',
        props: {
          updateMask: '',
          requestBody: course,
        },
      })
    }

    store.tasks.courseUpdateTasks.push({
      type: 'update',
      props: {
        updateMask: 'name,section,description,descriptionHeading,courseState',
        requestBody: course,
      },
    })
  }
}

// deno-lint-ignore require-await
export async function addClassTasksToStore(store: Store) {
  for (const [classCode, c] of store.timetable.classes) {
    if (c.isComposite) continue
    if (c.isExceptedSubject) continue

    const academicYear = getAcademicYearForClasscode(classCode)
    const alias = `${academicYear}-${classCode}`

    const course = {
      id: alias,
      ownerId: appSettings.classadmin,
      name: `${c.classCodeWithSemeterPrefix} | ${academicYear}`,
      section: `${c.name} ${academicYear}`,
      description:
        `Academic Year: ${academicYear}. Domain: ${c.domain} - ${c.name} (${c.classCodeWithSemeterPrefix})`,
      descriptionHeading: `Subject Domain: ${c.domain}`,
      courseState: 'ACTIVE',
    }

    if (!store.remote.courseAliases.has(alias)) {
      store.tasks.courseCreationTasks.push({
        type: 'create',
        props: {
          updateMask: '',
          requestBody: course,
        },
      })
    }

    store.tasks.courseUpdateTasks.push({
      type: 'update',
      props: {
        updateMask: 'name,section,description,descriptionHeading,courseState',
        requestBody: course,
      },
    })
  }
}

export async function addStudentEnrolmentTasksToStore(store: Store) {
  const auth = store.auth
  let timetabledCourses: TimetabledCourse[] = []

  const compositeClassEnrolments = getEnrolments(
    store,
    'students',
    'class',
    store.timetable.compositeClasses,
  )

  const classEnrolments = getEnrolments(
    store,
    'students',
    'class',
    store.timetable.classes,
  )

  if (compositeClassEnrolments.length) {
    timetabledCourses = timetabledCourses.concat(compositeClassEnrolments)
  }

  if (classEnrolments.length) {
    timetabledCourses = timetabledCourses.concat(classEnrolments)
  }

  const remoteCourseEnrolments = await Promise.all(
    timetabledCourses.map(async (course, index) => {
      const courseId = course.courseCode

      return await googleClassroom.listCourseMembers(
        auth,
        'students',
        courseId,
        index,
        timetabledCourses.length,
      )
    }),
  )

  for (const tc of timetabledCourses) {
    const courseId = tc.courseCode

    if (!('students' in tc)) {
      continue
    }

    const students = tc.students
    for (const remoteCourse of remoteCourseEnrolments) {
      if (remoteCourse && remoteCourse.courseId === courseId) {
        const diffedStudents = diffArrays(
          students,
          remoteCourse.students as string[],
        )

        const studentsToAdd = diffedStudents.arr1Diff
        for (const student of studentsToAdd) {
          if (!store.remote.activeUsers.has(student)) {
            continue
          }

          store.tasks.enrolmentTasks.push({
            type: 'students',
            action: 'POST',
            courseId: remoteCourse.courseId as string,
            user: {
              userId: student,
            },
          } as googleClassroom.CourseMemberProps)
        }

        const studentsToRemove = diffedStudents.arr2Diff
        for (const student of studentsToRemove) {
          store.tasks.enrolmentTasks.push({
            type: 'students',
            action: 'DELETE',
            courseId: remoteCourse.courseId as string,
            user: {
              userId: student,
            },
          } as googleClassroom.CourseMemberProps)
        }
      }
    }
  }
}

export async function addDailyorgEnrolmentTasksToStore(store: Store) {
  const auth = store.auth

  const dailyorgEnrolments: TimetabledCourse[] = []

  for (const [classCode, replacement] of store.replacements.dailyorgReplacements) {
    const courseCode = `${getAcademicYearForClasscode(classCode)}-${classCode}`
    dailyorgEnrolments.push({
      courseCode,
      teachers: [...replacement.subjectTeachers],
    })
  }

  const remoteCourseEnrolments = await Promise.all(
    dailyorgEnrolments.map(async (course, index) => {
      const courseId = course.courseCode

      return await googleClassroom.listCourseMembers(
        auth,
        'teachers',
        courseId,
        index,
        dailyorgEnrolments.length,
      )
    }),
  )

  for (const [code, enrolments] of store.replacements.dailyorgReplacements) {
    const academicYear = getAcademicYearForClasscode(code)
    const courseId = `${academicYear}-${code}`

    if (!store.remote.courseAliases.has(courseId)) {
      console.log(`Course ${courseId} not found`)
      continue
    }

    const remoteCourse = remoteCourseEnrolments.filter((c) => {
      return c?.courseId === courseId
    })

    for (const teacher of enrolments.subjectTeachers) {
      if (remoteCourse[0]?.teachers.includes(teacher)) continue

      store.tasks.enrolmentTasks.push({
        type: 'teachers',
        action: 'POST',
        courseId,
        user: {
          userId: teacher,
        },
      } as googleClassroom.CourseMemberProps)
    }
  }
}

export async function addTeacherEnrolmentTasksToStore(store: Store) {
  const auth = store.auth
  let timetabledCourses: TimetabledCourse[] = []

  const compositeClassEnrolments = getEnrolments(
    store,
    'subjectTeachers',
    'class',
    store.timetable.compositeClasses,
  )

  timetabledCourses = timetabledCourses.concat(compositeClassEnrolments)

  const classEnrolments = getEnrolments(
    store,
    'subjectTeachers',
    'class',
    store.timetable.classes,
  )

  timetabledCourses = timetabledCourses.concat(classEnrolments)

  const subjectEnrolments = getEnrolments(
    store,
    'subjectTeachers',
    'subject',
    store.timetable.subjects,
  )

  timetabledCourses = timetabledCourses.concat(subjectEnrolments)

  const remoteCourseEnrolments = await Promise.all(
    timetabledCourses.map(async (course, index) => {
      const courseId = course.courseCode

      return await googleClassroom.listCourseMembers(
        auth,
        'teachers',
        courseId,
        index,
        timetabledCourses.length,
      )
    }),
  )

  for (const tc of timetabledCourses) {
    const courseId = tc.courseCode

    if (!('subjectTeachers' in tc)) {
      continue
    }

    const teachers: string[] = tc.subjectTeachers as string[]
    for (const remoteCourse of remoteCourseEnrolments) {
      if (remoteCourse && remoteCourse.courseId === courseId) {
        const diffedTeachers = diffArrays(
          teachers,
          remoteCourse.teachers as string[],
        )

        const teachersToAdd = diffedTeachers.arr1Diff
        for (const teacher of teachersToAdd) {
          if (!store.remote.activeUsers.has(teacher)) {
            continue
          }

          store.tasks.enrolmentTasks.push({
            type: 'teachers',
            action: 'POST',
            courseId: remoteCourse.courseId as string,
            user: {
              userId: teacher,
            },
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

          if (appSettings.removeNonTimetabledTeachers) {
            store.tasks.enrolmentTasks.push({
              type: 'teachers',
              action: 'DELETE',
              courseId: remoteCourse.courseId as string,
              user: {
                userId: teacher,
              },
            } as googleClassroom.CourseMemberProps)
          }
        }
      }
    }
  }
}

export async function addReplacementEnrolmentTasksToStore(store: Store) {
  const auth = store.auth
  const replacementCourses: TimetabledCourse[] = store.replacements.individualReplacements

  const remoteCourseEnrolments = await Promise.all(
    replacementCourses.map(async (course, index) => {
      const courseId = course.courseCode

      return await googleClassroom.listCourseMembers(
        auth,
        'teachers',
        courseId,
        index,
        replacementCourses.length,
      )
    }),
  )

  for (const replacementCourse of replacementCourses) {
    if (!('teachers' in replacementCourse)) {
      continue
    }

    const courseId = replacementCourse.courseCode
    const teachers = replacementCourse.teachers

    // if (!remoteCourseEnrolments.length) continue

    for (const remoteCourse of remoteCourseEnrolments) {
      if (remoteCourse && remoteCourse.courseId === courseId) {
        const diffedTeachers = diffArrays(
          teachers,
          remoteCourse.teachers as string[],
        )

        const teachersToAdd = diffedTeachers.arr1Diff
        for (const teacher of teachersToAdd) {
          if (!store.remote.activeUsers.has(teacher)) {
            continue
          }

          store.tasks.enrolmentTasks.push({
            type: 'teachers',
            action: 'POST',
            courseId: remoteCourse.courseId as string,
            user: {
              userId: teacher,
            },
          } as googleClassroom.CourseMemberProps)
        }
      }
    }
  }
}

// deno-lint-ignore require-await
export async function addCourseArchiveTasksToStore(store: Store) {
  const remoteCourseArchiveCandidates: Set<string> = new Set()

  for (const [courseAlias, id] of store.remote.courseAliases) {
    const aliasPrefix = courseAlias.substring(0, 4)

    if (aliasPrefix === 'SUBJ') {
      continue
    }

    const course = store.remote.courses.get(id) as {
      name: string
      courseState: string
    }

    if (course.courseState.toLowerCase() === 'active') {
      remoteCourseArchiveCandidates.add(courseAlias)
    }
  }

  for (const [classCode, _c] of store.timetable.classes) {
    const academicYear = getAcademicYearForClasscode(classCode)
    const currentTimeTabledClass = `${academicYear}-${classCode}`

    remoteCourseArchiveCandidates.delete(currentTimeTabledClass)
  }

  for (const [classCode, _c] of store.timetable.compositeClasses) {
    const academicYear = getAcademicYearForClasscode(classCode)
    const currentTimeTabledClass = `${academicYear}-${classCode}`

    remoteCourseArchiveCandidates.delete(currentTimeTabledClass)
  }

  for (const alias of remoteCourseArchiveCandidates) {
    const id = store.remote.courseAliases.get(alias)

    if (!id) {
      throw 'addCourseArchiveTasksToStore(): Id Not found'
    }

    const course = store.remote.courses.get(id) as {
      name: string
      section: string
      descriptionHeading: string
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
        ownerId: appSettings.classadmin,
      },
    }

    if (store.remote.courseAliases.has(alias)) {
      store.tasks.courseArchiveTasks.push({
        type: 'archive',
        props,
      })
    }
  }
}

// deno-lint-ignore require-await
export async function addCourseDeletionTasksToStore(store: Store) {
  const currentAcademicCourseYears = getCurrentAcademicYearSet()
  const yearValues: number[] = []

  appSettings.academicYearMap.forEach((year) => {
    yearValues.push(parseInt(year))
  })

  const lowestRelevantCourseYear = Math.min(...yearValues) - 1

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

export function getEnrolments(
  store: Store,
  memberType: 'students' | 'subjectTeachers',
  courseType: 'subject' | 'class',
  courses: Map<string, Enrolments>,
) {
  const timetabledCourses = []
  let courseCode: string

  for (const [code, c] of courses) {
    if (courseType === 'subject') {
      courseCode = `SUBJ-${code}`
    } else {
      const academicYear = getAcademicYearForClasscode(code)
      courseCode = `${academicYear}-${code}`
    }

    const members = Array.from(c[memberType])

    if (store.remote.courseAliases.has(courseCode)) {
      timetabledCourses.push({
        courseCode,
        [memberType]: members,
      } as TimetabledCourse)
    }
  }
  return timetabledCourses
}

function getCurrentAcademicYearSet() {
  const releventYears = new Set()
  for (const [_yearlevel, year] of appSettings.academicYearMap) {
    releventYears.add(year)
  }
  return releventYears
}

export function getAcademicYearForClasscode(classCode: string) {
  const decimalChars = /\d+/g
  const matchedDecimalsArray = [...classCode.matchAll(decimalChars)]

  const decimalsArray = matchedDecimalsArray.flat()
  let releventYear = ''

  if (decimalsArray.length === 1) {
    const yearLevel = decimalsArray[0].slice(0, 2)
    const year = appSettings.academicYearMap.get(yearLevel)

    if (typeof year === 'string') {
      releventYear = year
    }
  }

  if (decimalsArray.length > 1) {
    const yearLevel = decimalsArray[decimalsArray.length - 1].slice(0, 2)
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
