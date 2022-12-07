import { Store } from './store.ts'
import * as googleClassroom from './google-actions.ts'
import { Enrolments, Subject, Class } from './subjects-and-classes.ts'
import appSettings from '../config/config.ts'

export interface CourseTask {
  type: 'create' |
  'update' |
  'archive' |
  'addStudent' |
  'removeStudent' |
  'addTeacher' |
  'removeTeacher'
  attributes: {
    id: string
    ownerId: string
    name: string
    section: string
    description: string
    descriptionHeading: string,
    courseState: string
  }
}

export interface EnrolmentTask {
  type: 'students' | 'teachers'
  action: 'POST' | 'DELETE'
  id: string
  student: string
}

type TimetabledClass = {
  classCode: string, students: string[]
} | { classCode: string, teachers: string[] }

// deno-lint-ignore require-await
export async function addSubjectAndClassTasksToStore(store: Store) {
  for (const [subjectcode, s] of store.timetable.subjects) {
    addSubjectTasksToStore(store, subjectcode, s)
  }

  for (const [classCode, c] of store.timetable.classes) {
    addClassTasksToStore(store, classCode, c)
  }
}

// deno-lint-ignore require-await
export async function addCompositeClassTasksToStore(store: Store) {
  for (const [classKey, _c] of store.timetable.compositeClasses) {
    const alias = `${appSettings.academicYear}-${classKey}`
    const name = `${classKey} (Composite)`
    const description = `Composite Class (${classKey})`

    const attributes = {
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
        attributes
      })
    }

    store.tasks.courseUpdateTasks.push({
      type: 'update',
      attributes
    })
  }
}

function addSubjectTasksToStore(
  store: Store,
  subjectCode: string,
  subject: Subject
) {
  const alias = `SUBJ-${subjectCode}`
  const attributes = {
    id: alias,
    ownerId: appSettings.classadmin,
    name: `${subjectCode} (Teachers)`,
    section: subject.name,
    description: `Domain: ${subject.domain} - ${subject.name} (Teachers)`,
    descriptionHeading: `Subject Domain: ${subject.domain}`,
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

function addClassTasksToStore(store: Store, classCode: string, c: Class) {
  const alias = `${appSettings.academicYear}-${classCode}`

  const attributes = {
    id: alias,
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

      const alias = `${appSettings.academicYear}-${ttClass.classCode}`

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
    const alias = `${appSettings.academicYear}-${tc.classCode}`

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
            studentsToAdd.forEach((student) => {
              store.tasks.enrolmentTasks.push({
                type: 'students',
                action: 'POST',
                id: remoteCourse.courseId as string,
                student
              })
            })

            const studentsToRemove = diffedStudents.arr2Diff
            studentsToRemove.forEach((student) => {
              store.tasks.enrolmentTasks.push({
                type: 'students',
                action: 'DELETE',
                id: remoteCourse.courseId as string,
                student
              })
            })
          }
        }
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
    const alias = `${appSettings.academicYear}-${classCode}`
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