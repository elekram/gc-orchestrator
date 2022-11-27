// import googleAuth from './src/auth.ts';
import { store } from './src/store.ts'
import { getLogger } from './src/log.ts';
import appSettings from './config/config.ts'
import { getSubjectsAndClasses } from './src/subjects-and-classes.ts';
import testSubjects from './src/test-subjects.ts'
import {
  addSubjectTasksToStore,
  addClassTasksToStore,
  addCompositeClassTasksToStore,
  addStudentEnrolmentTasks
} from './src/tasks.ts'
import { addCourseAliasMapToStore, addCoursesToStore } from './src/courses.ts'
import { getToken } from './src/google-jwt-sa.ts'
import * as googleClassroom from './src/google-actions.ts';

const logger = await getLogger()

const googleServiceAccountJson = await Deno.readTextFile(
  appSettings.serviceAccountCredentials
)

store.auth = await getToken(googleServiceAccountJson, {
  scope: appSettings.scopes,
  delegationSubject: appSettings.jwtSubject
})

store.subjects = getSubjectsAndClasses().subjects
store.compositeClasses = getSubjectsAndClasses().compositeClasses

testSubjects(store.subjects)
const input = prompt('\nWould you like to continue? (y/n)')

if (input === null || input.toLowerCase() !== 'y') {
  console.log('\n%c[ Script Exiting ]\n', 'color:magenta')
  Deno.exit()
}

//await addCoursesToStore(store)
// await addCourseAliasMapToStore(store)

// addSubjectTasksToStore(store)
// addClassTasksToStore(store)
// addCompositeClassTasksToStore(store)
addStudentEnrolmentTasks(store)
//const res = await googleClassroom.listCourseMembers(store.auth, 'students', '2022-ENG08A')
// console.log(res)




// const r = /\d+/g
// const s = '2MTH125'
// const array = [...s.matchAll(r)];
// console.log(array)





// tasks.subjectCreationTasks(store)
// tasks.classCreationTasks(store)
//tasks.getClassCreationTasks(store)
// console.dir(store.courseTasks, { maxArrayLength: null })
//await getCoursesFromGoogle(store)
// console.log(store.auth)
// console.log(store.subjects)

// testSubjects(store.subjects)



