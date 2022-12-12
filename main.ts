// import googleAuth from './src/auth.ts';
import { store } from './src/store.ts'
import { getLogger } from './src/log.ts';
import appSettings from './config/config.ts'
import { addTimetableToStore } from './src/subjects-and-classes.ts';
import testSubjects from './src/test-subjects.ts'
import * as tasks from './src/tasks.ts'
import { addCourseAliasMapToStore, addCoursesToStore } from './src/courses.ts'
import { getToken } from './src/google-jwt-sa.ts'
import * as googleClassroom from './src/google-actions.ts';

// const logger = await getLogger()

const googleServiceAccountJson = await Deno.readTextFile(
  appSettings.serviceAccountCredentials
)

store.auth = await getToken(googleServiceAccountJson, {
  scope: appSettings.scopes,
  delegationSubject: appSettings.jwtSubject
})

addTimetableToStore(store)
testSubjects(store)

// const input = prompt('\nWould you like to continue? (y/n)')

// if (input === null || input.toLowerCase() !== 'y') {
//   console.log('\n%c[ Script Exiting ]\n', 'color:magenta')
//   Deno.exit()
// }

await addCoursesToStore(store)
await addCourseAliasMapToStore(store)

await tasks.addSubjectTasksToStore(store)
await tasks.addClassTasksToStore(store)
await tasks.addCompositeClassTasksToStore(store)
await tasks.addTeacherEnrolmentTasksToStore(store)
await tasks.addStudentEnrolmentTasksToStore(store)
await tasks.addCourseArchiveTasksToStore(store)

//console.log(store.tasks.enrolmentTasks)
//console.log(store.tasks.enrolmentTasks)

// console.log(store.tasks.courseCreationTasks)
//console.log(store.tasks.courseUpdateTasks)

// console.log(store.tasks.courseCreationTasks.length)
// console.log(store.tasks.courseUpdateTasks.length)
//console.log(store.tasks.courseArchiveTasks.length)
// tasks.subjectCreationTasks(store)
// tasks.classCreationTasks(store)
//tasks.getClassCreationTasks(store)
// console.dir(store.courseTasks, { maxArrayLength: null })




