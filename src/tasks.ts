import { Store } from './store.ts'
import * as googleClassroom from './google-actions.ts'
import { diffArrays } from './diff-arrays.ts'
import appSettings from '../config/config.ts'

export enum CourseType {
  TeacherCourse = 'TEACHER_COURSE',
  ClassCourse = 'CLASS_COURSE',
  SubjectCourse = 'SUBJECT_COURSE',
}

enum TimetableGrouping {
  ClassStudents = 'students',
  SubjectStudents = 'subjectStudents',
  SubjectTeachers = 'subjectTeachers',
}

enum CourseEnrolmentType {
  Students = 'students',
  Teachers = 'teachers',
}

enum CourseTaskType {
  Create = 'create',
  Update = 'update',
  Archive = 'archive',
  Delete = 'delete',
}

enum EnrolmentTask {
  Add = 'POST',
  Remove = 'DELETE',
}

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
  courseAlias: string
  students: string[]
  teachers: string[]
}

export function addSubjectCourseTasksToStore(store: Store) {
  /*
    Subject course with teachers and students
    from all the subject classes enrolled
  */
  const alreadyProcessedSubjects = new Set<string>()

  for (const [code, c] of store.timetable.classes) {
    if (!c.hasSchedule) continue
    if (c.isExceptedSubject) continue
    if (!c.rotations.has(appSettings.griddleRotation.toUpperCase())) continue



    const subjectCode = code.split('.')[0]
    const classCode = code.split('.')[1]

    if (alreadyProcessedSubjects.has(subjectCode)) continue
    const subjectsCourseMap = appSettings.subjectsCourseMap

    if (!subjectsCourseMap.has(c.domainCode.toUpperCase())) continue

    let classYearLevel = ""
    const potentialYearLevel = subjectCode.substring(0, 2)
    if (isNumeric(potentialYearLevel)) {
      classYearLevel = potentialYearLevel
    }

    if (!isNumeric(potentialYearLevel)) {
      classYearLevel = subjectCode.substring(0, 1)
    }

    if (!isNumeric(classYearLevel)) {
      throw `Year level in subject code failed check ${subjectCode}`
    }

    if (!subjectsCourseMap.get(c.domainCode)?.includes(classYearLevel)) continue

    const courseType = CourseType.SubjectCourse
    const academicYear = getAcademicYearForClasscode(classCode)

    const alias =
      `${appSettings.aliasVersion}.${courseType}.${subjectCode}.${academicYear}`

    const course = {
      id: alias,
      ownerId: appSettings.classadmin,
      name: `${subjectCode} (Students) | ${academicYear}`,
      section: c.name,
      description: `Domain: ${c.domain} - ${c.name} (Students)`,
      descriptionHeading: `Subject Domain: ${c.domain}`,
      courseState: 'ACTIVE',
    }

    if (!store.remote.courseAliases.has(alias)) {
      store.tasks.courseCreationTasks.push({
        type: CourseTaskType.Create,
        props: {
          updateMask: '',
          requestBody: course,
        },
      })
    }

    if (store.remote.courseAliases.has(alias)) {
      store.tasks.courseUpdateTasks.push({
        type: CourseTaskType.Update,
        props: {
          updateMask: 'name,section,description,descriptionHeading,courseState',
          requestBody: course,
        },
      })
    }

    alreadyProcessedSubjects.add(subjectCode)
  }
}

// deno-lint-ignore require-await
export async function addCompositeClassCourseTasksToStore(store: Store) {
  for (const [code, c] of store.timetable.compositeClasses) {
    const _subjectCode = code.split('.')[0]
    const classCode = code.split('.')[1]

    const courseType = CourseType.ClassCourse
    const academicYear = getAcademicYearForClasscode(classCode)

    const alias = `${appSettings.aliasVersion}.${courseType}.${classCode}.${academicYear}`

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
        type: CourseTaskType.Create,
        props: {
          updateMask: '',
          requestBody: course,
        },
      })
    }

    if (store.remote.courseAliases.has(alias)) {
      store.tasks.courseUpdateTasks.push({
        type: CourseTaskType.Update,
        props: {
          updateMask: 'name,section,description,descriptionHeading,courseState',
          requestBody: course,
        },
      })
    }
  }
}

// deno-lint-ignore require-await
export async function addTeacherCourseTasksToStore(store: Store) {
  /*
    Subject course with only teachers enrolled
  */
  const alreadyProcessedSubjects = new Set<string>()

  for (const [code, c] of store.timetable.classes) {
    if (!c.hasSchedule) continue
    if (!c.rotations.has(appSettings.griddleRotation.toUpperCase())) continue

    const subjectCode = code.split('.')[0]
    const _classCode = code.split('.')[1]

    if (c.isExceptedSubject) continue
    if (alreadyProcessedSubjects.has(c.subjectCode)) continue

    const courseType = CourseType.TeacherCourse
    const alias = `${appSettings.aliasVersion}.${courseType}.${subjectCode}`

    const course = {
      id: alias,
      ownerId: appSettings.classadmin,
      name: `${c.subjectCode} (Teachers)`,
      section: c.name,
      description: `Domain: ${c.domain} - ${c.name} (Teacher Planning Classroom)`,
      descriptionHeading: `Subject Domain: ${c.domain}`,
      courseState: 'ACTIVE',
    }

    if (!store.remote.courseAliases.has(alias)) {
      store.tasks.courseCreationTasks.push({
        type: CourseTaskType.Create,
        props: {
          updateMask: '',
          requestBody: course,
        },
      })
    }

    if (store.remote.courseAliases.has(alias)) {
      store.tasks.courseUpdateTasks.push({
        type: CourseTaskType.Update,
        props: {
          updateMask: 'name,section,description,descriptionHeading,courseState',
          requestBody: course,
        },
      })
    }

    alreadyProcessedSubjects.add(subjectCode)
  }
}

// deno-lint-ignore require-await
export async function addClassCourseTasksToStore(store: Store) {
  for (const [code, c] of store.timetable.classes) {
    if (!c.hasSchedule) continue
    if (c.isExceptedSubject) continue
    if (c.isComposite) continue
    if (!c.rotations.has(appSettings.griddleRotation.toUpperCase())) continue

    const _subjectCode = code.split('.')[0]
    const classCode = code.split('.')[1]
    const courseType = CourseType.ClassCourse
    const academicYear = getAcademicYearForClasscode(classCode)
    const alias = `${appSettings.aliasVersion}.${courseType}.${classCode}.${academicYear}`

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
        type: CourseTaskType.Create,
        props: {
          updateMask: '',
          requestBody: course,
        },
      })
    }

    if (store.remote.courseAliases.has(alias)) {
      store.tasks.courseUpdateTasks.push({
        type: CourseTaskType.Update,
        props: {
          updateMask: 'name,section,description,descriptionHeading,courseState',
          requestBody: course,
        },
      })
    }
  }
}

export async function addStudentEnrolmentTasksToStore(store: Store) {
  const auth = store.auth
  let timetabledCourses: TimetabledCourse[] = []

  const compositeClassEnrolments = getEnrolments(
    store,
    TimetableGrouping.ClassStudents,
    CourseType.ClassCourse,
    store.timetable.compositeClasses,
  )

  const classEnrolments = getEnrolments(
    store,
    TimetableGrouping.ClassStudents,
    CourseType.ClassCourse,
    store.timetable.classes,
  )

  const subjectCourseEnrollments = getEnrolments(
    store,
    TimetableGrouping.SubjectStudents,
    CourseType.SubjectCourse,
    store.timetable.classes,
  )

  if (compositeClassEnrolments.length) {
    timetabledCourses = timetabledCourses.concat(compositeClassEnrolments)
  }

  if (classEnrolments.length) {
    timetabledCourses = timetabledCourses.concat(classEnrolments)
  }

  if (subjectCourseEnrollments.length) {
    timetabledCourses = timetabledCourses.concat(subjectCourseEnrollments)
  }

  const remoteCourseEnrolments = await Promise.all(
    timetabledCourses.map(async (course, index) => {
      const courseId = course.courseAlias

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
    const courseId = tc.courseAlias

    if (!('students' in tc)) {
      continue
    }

    const students = tc.students
    for (const remoteCourse of remoteCourseEnrolments) {
      if (remoteCourse && remoteCourse.courseId === courseId) {
        if (!Array.isArray(remoteCourse.students)) {
          throw 'remoteCourse.students is not an array'
        }

        const diffedStudents = diffArrays(
          students,
          remoteCourse.students,
        )

        const studentsToAdd = diffedStudents.arr1Diff
        for (const student of studentsToAdd) {
          if (!store.remote.activeUsers.has(student)) {
            continue
          }

          store.tasks.enrolmentTasks.push({
            type: CourseEnrolmentType.Students,
            action: EnrolmentTask.Add,
            courseId: remoteCourse.courseId,
            user: {
              userId: student,
            },
          })
        }

        const studentsToRemove = diffedStudents.arr2Diff
        for (const student of studentsToRemove) {
          if (!appSettings.removeNonTimetabledStudents) continue

          const classCode = courseId.split('.')[2] // classcode from course alias
          const s = student.split('@')[0].toUpperCase()
          if (store.enrolmentExceptions.studentExceptions.get(s)?.includes(classCode)) {
            continue
          }

          store.tasks.enrolmentTasks.push({
            type: CourseEnrolmentType.Students,
            action: EnrolmentTask.Remove,
            courseId: remoteCourse.courseId,
            user: {
              userId: student,
            },
          })
        }
      }
    }
  }
}

export async function addDailyorgEnrolmentTasksToStore(store: Store) {
  const auth = store.auth
  const dailyorgEnrolments: TimetabledCourse[] = []

  for (const [classCode, replacement] of store.replacements.dailyorgReplacements) {
    const academicYear = getAcademicYearForClasscode(classCode)
    const courseType = CourseType.ClassCourse

    const courseAlias =
      `${appSettings.aliasVersion}.${courseType}.${classCode}.${academicYear}`

    if (!store.remote.courseAliases.has(courseAlias)) continue

    dailyorgEnrolments.push({
      courseAlias,
      teachers: [...replacement.subjectTeachers],
      students: [],
    })
  }

  const remoteCourseEnrolments = await Promise.all(
    dailyorgEnrolments.map(async (course, index) => {
      const courseId = course.courseAlias
      return await googleClassroom.listCourseMembers(
        auth,
        CourseEnrolmentType.Teachers,
        courseId,
        index,
        dailyorgEnrolments.length,
      )
    }),
  )

  for (const [code, enrolments] of store.replacements.dailyorgReplacements) {
    const academicYear = getAcademicYearForClasscode(code)
    const courseAlias =
      `${appSettings.aliasVersion}.${CourseType.ClassCourse}.${code}.${academicYear}`

    if (!store.remote.courseAliases.has(courseAlias)) {
      console.log(`Course ${courseAlias} not found`)
      continue
    }

    const remoteCourse = remoteCourseEnrolments.filter((c) => {
      return c?.courseId === courseAlias
    })

    for (const teacher of enrolments.subjectTeachers) {
      if (!store.remote.activeUsers.has(teacher)) continue
      if (remoteCourse[0]?.teachers.includes(teacher)) continue

      store.tasks.enrolmentTasks.push({
        type: CourseEnrolmentType.Teachers,
        action: EnrolmentTask.Add,
        courseId: courseAlias,
        user: {
          userId: teacher,
        },
      })
    }
  }
}

export async function addTeacherEnrolmentTasksToStore(store: Store) {
  const auth = store.auth
  let timetabledCourses: TimetabledCourse[] = []

  const compositeClassEnrolments = getEnrolments(
    store,
    TimetableGrouping.SubjectTeachers,
    CourseType.ClassCourse,
    store.timetable.compositeClasses,
  )

  timetabledCourses = timetabledCourses.concat(compositeClassEnrolments)

  const classCourseEnrolments = getEnrolments(
    store,
    TimetableGrouping.SubjectTeachers,
    CourseType.ClassCourse,
    store.timetable.classes,
  )

  timetabledCourses = timetabledCourses.concat(classCourseEnrolments)

  const teacherCourseEnrolments = getEnrolments(
    store,
    TimetableGrouping.SubjectTeachers,
    CourseType.TeacherCourse,
    store.timetable.classes,
  )

  timetabledCourses = timetabledCourses.concat(teacherCourseEnrolments)

  const subjectCourseEnrolments = getEnrolments(
    store,
    TimetableGrouping.SubjectTeachers,
    CourseType.SubjectCourse,
    store.timetable.classes,
  )

  timetabledCourses = timetabledCourses.concat(subjectCourseEnrolments)

  const remoteCourseEnrolments = await Promise.all(
    timetabledCourses.map(async (course, index) => {
      const courseId = course.courseAlias
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
    const courseId = tc.courseAlias

    if (!(TimetableGrouping.SubjectTeachers in tc)) {
      continue
    }

    if (!Array.isArray(tc.subjectTeachers)) throw 'tc.subjectTeachers is not an Array'

    const teachers: string[] = tc.subjectTeachers
    for (const remoteCourse of remoteCourseEnrolments) {
      if (remoteCourse && remoteCourse.courseId === courseId) {
        if (!Array.isArray(remoteCourse.teachers)) {
          throw 'remoteCourse.teachers is not an Array'
        }

        if (typeof remoteCourse.courseId !== 'string') {
          throw 'remoteCourse.courseId is not of string type'
        }

        const diffedTeachers = diffArrays(
          teachers,
          remoteCourse.teachers,
        )

        const teachersToAdd = diffedTeachers.arr1Diff
        for (const teacher of teachersToAdd) {
          if (!store.remote.activeUsers.has(teacher)) {
            continue
          }

          store.tasks.enrolmentTasks.push({
            type: CourseEnrolmentType.Teachers,
            action: EnrolmentTask.Add,
            courseId: remoteCourse.courseId,
            user: {
              userId: teacher,
            },
          })
        }

        const teachersToRemove = diffedTeachers.arr2Diff
        for (const teacher of teachersToRemove) {
          if (teacher.toLowerCase() === appSettings.classadmin) {
            continue
          }

          if (appSettings.teacherAides.includes(teacher.toLowerCase())) {
            continue
          }

          const classCode = courseId.split('.')[2] // classcode from course alias
          const t = teacher.split('@')[0].toUpperCase()
          if (store.enrolmentExceptions.teacherExceptions.get(t)?.includes(classCode)) {
            continue
          }

          if (
            store.replacements.dailyorgReplacements.has(classCode) &&
            store.replacements.dailyorgReplacements.get(classCode)
              ?.subjectTeachers.has(teacher)
          ) continue

          if (!appSettings.removeNonTimetabledTeachers) continue

          store.tasks.enrolmentTasks.push({
            type: CourseEnrolmentType.Teachers,
            action: EnrolmentTask.Remove,
            courseId: remoteCourse.courseId,
            user: {
              userId: teacher,
            },
          })
        }
      }
    }
  }
}

// deno-lint-ignore require-await
export async function addCourseArchiveTasksToStore(store: Store) {
  const remoteCourseArchiveCandidates: Set<string> = new Set()

  for (const [courseAlias, id] of store.remote.courseAliases) {
    const aliasFields = courseAlias.split('.')
    const courseType = aliasFields[1]

    if (courseType === CourseType.TeacherCourse) {
      continue
    }

    const course = store.remote.courses.get(id)

    if (!course) continue

    if (course.courseState.toLowerCase() === 'active') {
      remoteCourseArchiveCandidates.add(courseAlias)
    }
  }

  for (const [code, c] of store.timetable.classes) {
    if (!c.hasSchedule) continue
    if (!c.rotations.has(appSettings.griddleRotation.toUpperCase())) continue

    const subjectCode = code.split('.')[0]
    const classCode = code.split('.')[1]

    const academicYear = getAcademicYearForClasscode(classCode)
    const currentTimetabledClass =
      `${appSettings.aliasVersion}.${CourseType.ClassCourse}.${classCode}.${academicYear}`

    remoteCourseArchiveCandidates.delete(currentTimetabledClass)

    let classYearLevel = ""
    const potentialYearLevel = subjectCode.substring(0, 2)
    if (isNumeric(potentialYearLevel)) {
      classYearLevel = potentialYearLevel
    }

    if (!isNumeric(potentialYearLevel)) {
      classYearLevel = subjectCode.substring(0, 1)
    }

    if (!isNumeric(classYearLevel)) {
      throw `Year level in subject code failed check ${subjectCode}`
    }

    if (appSettings.subjectsCourseMap.get(c.domainCode)?.includes(classYearLevel)) {
      const currentTimetabledSujectCourse =
        `${appSettings.aliasVersion}.${CourseType.SubjectCourse}.${subjectCode}.${academicYear}`

      remoteCourseArchiveCandidates.delete(currentTimetabledSujectCourse)
    }
  }

  for (const [code, _c] of store.timetable.compositeClasses) {
    const _subjectCode = code.split('.')[0]
    const classCode = code.split('.')[1]

    const academicYear = getAcademicYearForClasscode(classCode)
    const currentTimeTabledClass =
      `${appSettings.aliasVersion}.${CourseType.ClassCourse}.${classCode}.${academicYear}`

    remoteCourseArchiveCandidates.delete(currentTimeTabledClass)
  }

  for (const alias of remoteCourseArchiveCandidates) {
    const id = store.remote.courseAliases.get(alias)

    if (!id) {
      throw 'addCourseArchiveTasksToStore(): Id Not found'
    }

    const course = store.remote.courses.get(id)

    if (!course) continue

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
        type: CourseTaskType.Archive,
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
  const subjectDeletionExceptions = appSettings.subjectDeletionExceptions

  for (const [courseAlias, _id] of store.remote.courseAliases) {
    if (subjectDeletionExceptions.includes(courseAlias)) continue

    const aliasFields = courseAlias.split('.')
    const courseType = aliasFields[1]

    if (courseType === CourseType.TeacherCourse) {
      continue
    }

    const courseYear = aliasFields[3]

    if (!currentAcademicCourseYears.has(courseYear)) {
      if (parseInt(courseYear) < lowestRelevantCourseYear) {
        store.tasks.courseDeletionTasks.push(courseAlias)
      }
    }
  }
}

export function getEnrolments(
  store: Store,
  timetableGrouping: TimetableGrouping,
  courseType: CourseType,
  timetable: Map<string, {
    subjectTeachers: Set<string>
    subjectStudents: Set<string>
    students: Set<string>
  }>,
) {
  const timetableGroupings = {
    [TimetableGrouping.ClassStudents]: 'students',
    [TimetableGrouping.SubjectStudents]: 'students',
    [TimetableGrouping.SubjectTeachers]: 'subjectTeachers',
  }

  const remoteEnrolmentTypes = new Map(Object.entries(timetableGroupings))

  const timetabledCourses: {
    courseAlias: string
    students: string[]
    teachers: string[]
  }[] = []

  const uniqueTimetabledCourses = new Set<string>()

  for (const [code, c] of timetable) {
    let courseAlias = ''
    const subjectCode = code.split('.')[0]
    const classCode = code.split('.')[1]

    if (courseType === CourseType.TeacherCourse) {
      courseAlias =
        `${appSettings.aliasVersion}.${CourseType.TeacherCourse}.${subjectCode}`
    }

    if (courseType === CourseType.ClassCourse) {
      const academicYear = getAcademicYearForClasscode(classCode)
      courseAlias =
        `${appSettings.aliasVersion}.${CourseType.ClassCourse}.${classCode}.${academicYear}`
    }

    if (courseType === CourseType.SubjectCourse) {
      const academicYear = getAcademicYearForClasscode(classCode)
      courseAlias =
        `${appSettings.aliasVersion}.${CourseType.SubjectCourse}.${subjectCode}.${academicYear}`
    }

    if (!courseAlias) throw 'Error: getEnrolments() - courseCode undefined'

    if (!store.remote.courseAliases.has(courseAlias)) continue

    const courseEnrollments = Array.from(c[timetableGrouping])
    const remoteMemberType = remoteEnrolmentTypes.get(timetableGrouping)

    if (!remoteMemberType) throw 'Member type undefined'

    uniqueTimetabledCourses.add(JSON.stringify({
      courseAlias,
      [remoteMemberType]: courseEnrollments,
    }))
  }

  for (const uniqueCourse of uniqueTimetabledCourses) {
    const parsedCourse = JSON.parse(uniqueCourse)
    timetabledCourses.push(parsedCourse)
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

// function isNumeric(str: string) {
//   if (typeof str != "string") return false // we only process strings!  
//   return !isNaN(Number(str)) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
//     !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
// }

export function getAcademicYearForClasscode(classCode: string) {
  let releventYear = ""
  const potentialYearLevel = classCode.substring(0, 2)

  if (isNumeric(potentialYearLevel)) {
    const year = appSettings.academicYearMap.get(potentialYearLevel)

    if (typeof year === 'string') {
      releventYear = year
    }

    if (!releventYear) {
      throw `Error: getAcademicYearForClasscode(classCode: ${classCode}) -> Year level code undefined`
    }

    return releventYear
  }

  if (!isNumeric(potentialYearLevel)) {
    const year = appSettings.academicYearMap.get(classCode.substring(0, 1))

    if (typeof year === 'string') {
      releventYear = year
    }

    if (!releventYear) {
      throw `Error: getAcademicYearForClasscode(classCode: ${classCode}) -> Year level code undefined`
    }

    return releventYear
  }

  // const decimalChars = /\d+/g
  // const matchedDecimalsArray = [...classCode.matchAll(decimalChars)]

  // const decimalsArray = matchedDecimalsArray.flat()
  // let releventYear = ''

  // if (decimalsArray.length === 1) {
  //   const yearLevel = decimalsArray[0].slice(0, 2)
  //   const year = appSettings.academicYearMap.get(yearLevel)

  //   if (typeof year === 'string') {
  //     releventYear = year
  //   }
  // }

  // if (decimalsArray.length > 1) {
  //   const yearLevel = decimalsArray[decimalsArray.length - 1].slice(0, 2)
  //   const year = appSettings.academicYearMap.get(yearLevel)

  //   if (typeof year === 'string') {
  //     releventYear = year
  //   }
  // }

  if (!releventYear) {
    throw `Error: getAcademicYearForClasscode(classCode: ${classCode}) -> Year level code undefined`
  }

  return releventYear
}

function isNumeric(value: string) {
  return /^[0-9]+$/.test(value)
}
