import { Store } from './store.ts'
import * as googleClassroom from './google-actions.ts'
import appSettings from '../config/config.ts'

export async function addCoursesToStore(store: Store) {
  const auth = store.auth
  const courses = await googleClassroom.listCourses(
    auth,
    'teacherId',
    appSettings.classadmin
  )

  for (const course of courses) {
    const googleCourseId = course.id as string
    store.remote.courses.set(googleCourseId, course)
  }
}

export async function addCourseAliasMapToStore(store: Store) {
  const auth = store.auth
  const courses = store.remote.courses

  const googleCoursesIds: string[] = []
  for (const [id, _course] of courses) {
    googleCoursesIds.push(id)
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
    const googleCourseId = alias.id
    alias.aliases.forEach(e => {
      const courseAlias = e
      store.remote.courseAliases.set(courseAlias, googleCourseId)
    })
  })
}


