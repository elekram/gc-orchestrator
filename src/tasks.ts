import { Store } from './store.ts'
import * as googleClassroom from './google-actions.ts'
import appSettings from '../config/config.ts'
import { strikethrough } from 'https://deno.land/std@0.165.0/fmt/colors.ts'

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

export function addSubjectTasksToStore(store: Store): void {
  const subjects = store.subjects

  for (const [subjectKey, subject] of subjects) {
    const alias = `d:SUBJ-${subjectKey}`
    const attributes = {
      id: alias,
      ownerId: appSettings.classadmin,
      name: `${subjectKey} (Teachers)`,
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
}

export function addClassTasksToStore(store: Store): void {
  const subjects = store.subjects

  for (const [_subjectkey, subject] of subjects) {
    const classes = subject.classes
    const name = subject.name

    for (const [classKey, _c] of classes) {
      const alias = `d:${appSettings.academicYear}-${classKey}`
      const attributes = {
        id: alias,
        ownerId: appSettings.classadmin,
        name,
        section: name,
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
}

export function addCompositeClassTasksToStore(store: Store): void {
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

export async function addStudentEnrolmentTasks(store: Store) {
  for (const [subjectKey, subject] of store.subjects) {
    for (const [classcode, students] of subject.classes) {
      console.log(classcode, students)
      const res = await googleClassroom.listCourseMembers(
        store.auth,
        'students',
        `${appSettings.academicYear}-${classcode}`)
      console.log(res)
    }
  }
}
