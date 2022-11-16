import { Subject, CompositeClass } from './get-subjects-and-classes.ts'
import { googleapis } from './deps.ts'

interface Store {
  auth: googleapis.Common.JWT
  subjects: Map<string, Subject>
  compositeClasses: Map<string, CompositeClass>
}

export const store: Store = {
  auth: new googleapis.Common.JWT(),
  subjects: new Map(),
  compositeClasses: new Map()
}

