// import { readRecord } from 'https://deno.land/std@0.162.0/encoding/csv/_io.ts'
import { GoogleAuth } from './google-jwt-sa.ts'
import { Subject, Enrolments } from './subjects-and-classes.ts'
import { CourseTask, EnrolmentTask } from './tasks.ts'

export interface Store {
  auth: GoogleAuth
  timetable: {
    subjects: Map<string, Subject>
    compositeClasses: Map<string, Enrolments>
  }
  remote: {
    courses: Map<string, unknown>
    courseAliases: Map<string, string>
  }
  tasks: {
    courseCreationTasks: CourseTask[]
    courseUpdateTasks: CourseTask[]
    enrolmentTasks: EnrolmentTask[]
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
    compositeClasses: new Map(),
  },
  remote: {
    courses: new Map(),
    courseAliases: new Map()
  },
  tasks: {
    courseCreationTasks: [],
    courseUpdateTasks: [],
    enrolmentTasks: []
  }
}

