//import google from 'npm:googleapis@109.0.1'
import { Store } from './store.ts'
import { googleClassroom } from './google-actions.ts'
import appSettings from '../config/config.ts'

export async function addCoursesToStore(store: Store) {
  const auth = store.auth
  const courses = await googleClassroom.listCourses(auth, 'teacherId', appSettings.classadmin)

  for (const course of courses) {
    const googleCourseId = course.id as string
    store.courses.set(googleCourseId, course)
  }
}

export async function addCourseAliasMapToStore(store: Store) {
  const auth = store.auth
  const courses = store.courses

  const googleCoursesIds: string[] = []
  for (const [courseId, _course] of courses) {
    googleCoursesIds.push(courseId)
  }

  const courseAliases = await Promise.all(
    googleCoursesIds.map(async (course, index) => {
      return await googleClassroom.getCourseAliases(
        auth,
        course,
        index,
        googleCoursesIds.length
      )
    })
  )

  courseAliases.forEach((alias) => {
    const courseId = alias.id
    alias.aliases.forEach(e => {
      store.courseAliases.set(e.substring(2), courseId)
    })
  })
  console.log(store.courseAliases)
}


