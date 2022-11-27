import { tinyLogger } from './deps.ts'
import { Subject } from './subjects-and-classes.ts'
import appSettings from '../config/config.ts'

export default function testSubjects(subjects: Map<string, Subject>) {
  const verboseWarnings = appSettings.verboseWarnings

  for (const [key, s] of subjects) {
    let isWarning = false

    if (!s.domain) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `Domain/Faculty not found in ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv'
      })
    }

    if (!s.leaders.size) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No domain leaders found in ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv'
      })
    }

    if (!s.teachers.size) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No teachers found in ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv'
      })
    }

    if (!s.classes.size) {
      isWarning = true
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No classes found in ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv'
      })
    }

    for (const [key, students] of s.classes) {
      if (!students.size) {
        isWarning = true
        const logLevel = 'warn'
        const type = 'ƒ-testSubject'
        const message = `No students found in class ${key}`

        tinyLogger.log(type, message, {
          logLevel,
          fileName: './log/log.csv'
        })
      }
    }

    if (verboseWarnings && isWarning) {
      console.dir(s, { maxArrayLength: null })
    }
  }
}
