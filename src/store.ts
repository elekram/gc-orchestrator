import { GoogleAuth } from './google-jwt-sa.ts'
import { Subject, Enrolments, Class } from './subjects-and-classes.ts'
import { CourseTask } from './tasks.ts'
import { CourseMemberProps } from './google-actions.ts'

export interface Store {
  auth: GoogleAuth
  timetable: {
    subjects: Map<string, Subject>
    classes: Map<string, Class>
    compositeClasses: Map<string, Enrolments>
  }
  remote: {
    courses: Map<string, unknown>
    courseAliases: Map<string, string>
  }
  tasks: {
    courseCreationTasks: CourseTask[]
    courseUpdateTasks: CourseTask[]
    courseArchiveTasks: CourseTask[]
    enrolmentTasks: CourseMemberProps[]
    courseDeletionTasks: string[]
  }
}

export const store: Store = {
  auth: {
    access_token: '',
    expires_in: 0,
    token_type: ''
  },
  timetable: {
    subjects: new Map(),
    classes: new Map(),
    compositeClasses: new Map(),
  },
  remote: {
    courses: new Map(),
    courseAliases: new Map()
  },
  tasks: {
    courseCreationTasks: [],
    courseUpdateTasks: [],
    courseArchiveTasks: [],
    enrolmentTasks: [],
    courseDeletionTasks: []
  }
}

