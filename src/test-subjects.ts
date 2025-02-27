import { tinyLogger } from './deps.ts'
import { Store } from './store.ts'
import appSettings from '../config/config.ts'

export default function testSubjects(store: Store) {
  const totalClasses = store.timetable.classes.size
  let classesWithoutStudents = 0
  let classesWithoutTeachers = 0
  let classesWithoutLeaders = 0

  for (const [key, c] of store.timetable.classes) {
    if (!c.domain) {
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `Domain/Faculty not found in subject ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv',
      })
    }

    if (!c.students.size) {
      classesWithoutStudents++
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No students found in class ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv',
      })

    }

    if (!c.subjectTeachers.size) {
      classesWithoutTeachers++
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No teachers found in class ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv',
      })
    }

    if (!c.subjectLeaders.size) {
      classesWithoutLeaders++
      const logLevel = 'warn'
      const type = 'ƒ-testSubject'
      const message = `No leaders found in class ${key}`

      tinyLogger.log(type, message, {
        logLevel,
        fileName: './log/log.csv',
      })
    }
  }

  const percentageClassesWithoutStudents = classesWithoutStudents / totalClasses * 100
  const percentageClassesWithouthTeachers = classesWithoutTeachers / totalClasses * 100

  if (percentageClassesWithoutStudents > appSettings.studentRemovalThreshold) {
    console.log(`\n%c[ WARNING MORE THAN ${appSettings.studentRemovalThreshold}% OF CLASSES DO NOT HAVE STUDENTS ENROLLED ]`, 'color:red')
    console.log(`%c[  THIS COULD LEAD TO A LARGE NUMBER OF ENROLMENT REMOVAL TASKS  ]\n`, 'color:red')

    const response = prompt('Do you want to continue? [Y/N]')
    if (response?.toUpperCase() !== 'Y') {
      Deno.exit()
    }
  }

  if (percentageClassesWithouthTeachers > appSettings.teacherRemovalThreshold) {
    console.log(`\n%c[ WARNING MORE THAN ${appSettings.teacherRemovalThreshold}% OF CLASSES DO NOT HAVE TEACHERS ENROLLED ]`, 'color:red')
    console.log(`%c[  THIS COULD LEAD TO A LARGE NUMBER OF ENROLMENT REMOVAL TASKS  ]\n`, 'color:red')

    const response = prompt('Do you want to continue? [Y/N]')
    if (response?.toUpperCase() !== 'Y') {
      Deno.exit()
    }
  }
}
