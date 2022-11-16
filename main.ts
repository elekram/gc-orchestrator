import googleAuth from './src/google-auth.ts';
import { store } from './src/store.ts'
import getSubjectsAndClasses from './src/get-subjects-and-classes.ts';
import testSubjects from './src/test-subjects.ts'

store.auth = googleAuth()
store.subjects = getSubjectsAndClasses().subjects
store.compositeClasses = getSubjectsAndClasses().compositeClasses

console.log(store.auth)
console.log(store.subjects)
testSubjects(store.subjects)



