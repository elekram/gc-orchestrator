import { tinyLogger } from './deps.ts'
import { Store } from './store.ts'
import { Subject } from './subjects-and-classes.ts'
import appSettings from '../config/config.ts'

export default function testSubjects(store: Store) {
  const verboseWarnings = appSettings.verboseWarnings
  let isWarning = false

  for (const [key, s] of store.timetable.subjects) {


    if (!s.domain) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `Domain/Faculty not found in subject ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv'
      })
    }

    if (!s.leaders.size) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No domain leaders found in subject ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv'
      })
    }

    if (!s.teachers.size) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No teachers found in subject ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv'
      })
    }

    if (verboseWarnings && isWarning) {
      console.dir(s, { maxArrayLength: null })
    }
  }

  for (const [key, c] of store.timetable.classes) {
    if (!c.students.size) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No students found in class ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv'
      })
    }

    if (!c.teachers.size) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No teachers found in class ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv'
      })
    }

    if (!c.leaders.size) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No leaders found in class ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv'
      })
    }
  }
}
