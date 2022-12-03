import { Store } from './store.ts'
import * as googleClassroom from './google-actions.ts'
import { Enrolments, Subject } from './subjects-and-classes.ts'
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

export async function addSubjectAndClassTasksToStore(store: Store) {
  for (const [subjectcode, subject] of store.timetable.subjects) {
    addSubjectTasksToStore(store, subjectcode, subject)
    addClassTasksToStore(store, subject)
  }
}

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

function addClassTasksToStore(store: Store, subject: Subject) {
  const classes = subject.classes

  for (const [classcode, _students] of classes) {
    const alias = `${appSettings.academicYear}-${classcode}`
    const attributes = {
      id: alias,
      ownerId: appSettings.classadmin,
      name: subject.name,
      section: subject.name,
      description: `Domain: ${subject.domain} - ${subject.name}`,
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
}

export async function addStudentEnrolmentTasksToStore(store: Store) {
  const auth = store.auth
  console.log(1)
  let timetabledClasses: TimetabledClass[] = []

  const compositeStudents = getEnrolmentsForClass(
    store,
    'students',
    store.timetable.compositeClasses
  )

  timetabledClasses = timetabledClasses.concat(compositeStudents)


  for (const [_subjectCode, subject] of store.timetable.subjects) {
    const classStudents = getEnrolmentsForClass(
      store,
      'students',
      subject.classes
    )

    if (classStudents.length) {
      timetabledClasses = timetabledClasses.concat(classStudents)
    }
  }
  console.log(timetabledClasses)
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

  for (const ttClass of timetabledClasses) {
    const alias = `${appSettings.academicYear}-${ttClass.classCode}`

    if ('students' in ttClass) {
      console.log(2)
      const students = ttClass.students
      const hasRemoteCourse = remoteCourseEnrolments.filter(match => {
        if (match) {
          return match.courseAlias === alias
        }
      })

      if (hasRemoteCourse.length) {
        console.log('remote course has')
        for (const remoteCourse of remoteCourseEnrolments) {
          if (remoteCourse.courseId === alias) {
            console.log('true')
            const diffedStudents = differentiateArrayElements(
              students,
              remoteCourse.students as string[]
            )
            console.log('diffed', diffedStudents)
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

function differentiateArrayElements(arr1: string[], arr2: string[]) {
  const arr1Diff = arr1.filter(item => !arr2.includes(item))
  const arr2Diff = arr2.filter(item => !arr1.includes(item))

  return {
    arr1Diff,
    arr2Diff
  }
}