import { Store } from './store.ts'
import * as googleClassroom from './google-actions.ts'
import { Subject } from './subjects-and-classes.ts'
import appSettings from '../config/config.ts'

export interface Task {
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

export function addTasksToStore(store: Store): void {
  const subjects = store.subjects

  for (const [subjectcode, subject] of subjects) {
    addSubjectTasksToStore(store, subjectcode, subject)
    addClassTasksToStore(store, subject)
    addStudentEnrolmentTasksToStore(store, subject)

  }
  addCompositeClassTasksToStore(store)
}

function addCompositeClassTasksToStore(store: Store): void {
  const classes = store.compositeClasses

  for (const [classKey, _c] of classes) {
    const alias = `d:${appSettings.academicYear}-${classKey}`
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

    if (!store.courseAliases.has(alias)) {
      store.courseCreationTasks.push({
        type: 'create',
        attributes
      })
    }

    store.courseUpdateTasks.push({
      type: 'update',
      attributes
    })
  }
}

function addSubjectTasksToStore(store: Store, subjectName: string, subject: Subject) {
  const alias = `d:SUBJ-${subjectName}`
  const attributes = {
    id: alias,
    ownerId: appSettings.classadmin,
    name: `${subjectName} (Teachers)`,
    section: subject.name,
    description: `Domain: ${subject.domain} - ${subject.name} (Teachers)`,
    descriptionHeading: `Subject Domain: ${subject.domain}`,
    courseState: 'ACTIVE'
  }

  if (!store.courseAliases.has(alias)) {
    store.courseCreationTasks.push({
      type: 'create',
      attributes
    })
  }

  store.courseUpdateTasks.push({
    type: 'update',
    attributes
  })
}

function addClassTasksToStore(store: Store, subject: Subject) {
  for (const [classcode, _students] of subject.classes) {
    const alias = `d:${appSettings.academicYear}-${classcode}`
    const attributes = {
      id: alias,
      ownerId: appSettings.classadmin,
      name: subject.name,
      section: subject.name,
      description: `Domain: ${subject.domain} - ${subject.name}`,
      descriptionHeading: `Subject Domain: ${subject.domain}`,
      courseState: 'ACTIVE'
    }

    if (!store.courseAliases.has(alias)) {
      store.courseCreationTasks.push({
        type: 'create',
        attributes
      })
    }

    store.courseUpdateTasks.push({
      type: 'update',
      attributes
    })
  }
}

async function addStudentEnrolmentTasksToStore(store: Store, subject: Subject) {
  const auth = store.auth

  const classcodes = Array.from(subject.classes.keys())
  console.log(classcodes)
  const remoteCourseEnrolments = await Promise.all(
    classcodes.map(async (c, index) => {
      const alias = `d:${appSettings.academicYear}-${c}`
      console.log(alias)

      return await googleClassroom.listCourseMembers(
        auth,
        'students',
        `d:${appSettings.academicYear}-${c}`,
        index,
        classcodes.length
      )

    })
  )
  console.log(remoteCourseEnrolments)
}