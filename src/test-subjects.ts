import { tinyLogger } from './deps.ts'
import { Store } from './store.ts'
import appSettings from '../config/config.ts'

export default function testSubjects(store: Store) {
  const verboseWarnings = appSettings.verboseWarnings
  let isWarning = false

  for (const [key, c] of store.timetable.classes) {
    if (!c.domain) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `Domain/Faculty not found in subject ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv',
      })
    }

    if (!c.students.size) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No students found in class ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv',
      })
    }

    if (!c.subjectTeachers.size) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No teachers found in class ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv',
      })
    }

    if (!c.subjectLeaders.size) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No leaders found in class ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv',
      })
    }
  }
}
