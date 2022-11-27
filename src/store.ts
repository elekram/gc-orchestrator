// import { readRecord } from 'https://deno.land/std@0.162.0/encoding/csv/_io.ts'
import { GoogleAuth } from './google-jwt-sa.ts'
import { Subject, CompositeClass } from './subjects-and-classes.ts'
import { Task } from './tasks.ts'

export interface Store {
  auth: GoogleAuth
  courses: Map<string, unknown>
  courseAliases: Map<string, string>
  subjects: Map<string, Subject>
  compositeClasses: Map<string, CompositeClass>
  courseCreationTasks: Task[]
  courseUpdateTasks: Task[]
}

export const store: Store = {
  auth: {
    access_token: '',
    expires_in: 0,
    token_type: ''
  },
  courses: new Map(),
  courseAliases: new Map(),
  subjects: new Map(),
  compositeClasses: new Map(),
  courseCreationTasks: [],
  courseUpdateTasks: []
}

