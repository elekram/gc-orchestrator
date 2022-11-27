import { Store } from './store.ts'
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
    courseState: 'ACTIVE' | 'ARCHIVED'
  }
}

export default {
  getSubjectCreationTasks(store: Store): void {
    const subjects = store.subjects

    for (const [subjectKey, subject] of subjects) {
      const alias = `d:SUBJ-${subjectKey}`

      store.courseTasks.push({
        type: 'create',
        attributes: {
          id: alias,
          ownerId: appSettings.classadmin,
          name: `${subjectKey} (Teachers)`,
          section: subject.name,
          description: `Domain: ${subject.domain} - ${subject.name} (Teachers)`,
          descriptionHeading: `Subject Domain: ${subject.domain}`,
          courseState: 'ACTIVE'
        }
      })
    }
  },

  getClassCreationTasks(store: Store): void {
    const subjects = store.subjects

    for (const [_subjectkey, subject] of subjects) {
      const classes = subject.classes
      const name = subject.name

      for (const [classKey, _c] of classes) {
        const alias = `d:${appSettings.academicYear}-${classKey}`

        store.courseTasks.push({
          type: 'create',
          attributes: {
            id: alias,
            ownerId: appSettings.classadmin,
            name,
            section: name,
            description: `Domain: ${subject.domain} - ${subject.name}`,
            descriptionHeading: `Subject Domain: ${subject.domain}`,
            courseState: 'ACTIVE'
          }
        })
      }
    }
  },

  getCompositeClassCreationTasks(store: Store): void {
    const classes = store.compositeClasses

    for (const [classKey, c] of classes) {
      const alias = `d:${appSettings.academicYear}-${classKey}`
      const name = `${classKey} (Composite)`
      const description = `Composite Class (${classKey})`

      store.courseTasks.push({
        type: 'create',
        attributes: {
          id: alias,
          ownerId: appSettings.classadmin,
          name,
          section: name,
          description,
          descriptionHeading: description,
          courseState: 'ACTIVE'
        }
      })
    }
  },

  getAttributeUpdateTasks(store: Store) {

  }
}