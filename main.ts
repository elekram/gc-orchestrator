// import googleAuth from './src/auth.ts';
import { store } from './src/store.ts'
import appSettings from './config/config.ts'
import getSubjectsAndClasses from './src/subjects-and-classes.ts';
import { tinyLogger } from './src/deps.ts'
import testSubjects from './src/test-subjects.ts'
import tasks from './src/tasks.ts'
import { addCourseAliasMapToStore, addCoursesToStore } from './src/courses.ts'
import { GoogleAuth, getToken } from './src/google-jwt-sa.ts'
import { googleClassroom } from './src/google-actions.ts'

const googleServiceAccountJson = await Deno.readTextFile(
  appSettings.serviceAccountCredentials
)

const token: GoogleAuth = await getToken(googleServiceAccountJson, {
  scope: appSettings.scopes,
  delegationSubject: appSettings.jwtSubject
})

store.auth = token

// const r = /\d+/g
// const s = '2MTH125'
// const array = [...s.matchAll(r)];
// console.log(array)

await addCoursesToStore(store)
await addCourseAliasMapToStore(store)



// tasks.subjectCreationTasks(store)
// tasks.classCreationTasks(store)
//tasks.getClassCreationTasks(store)
// console.dir(store.courseTasks, { maxArrayLength: null })
//await getCoursesFromGoogle(store)
// console.log(store.auth)
// console.log(store.subjects)

// testSubjects(store.subjects)



