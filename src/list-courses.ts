import { Store, store } from './store.ts'
import * as googleClassroom from './google-actions.ts'

export async function listCourses(store: Store, user: string) {
  const userId = user.toLowerCase()

  const courses = await googleClassroom.listCourses(
    store.auth,
    'teacherId',
    userId,
  )

  if (!courses) {
    console.log(`\n%cNo courses found for ${userId}`, 'color:red')
    Deno.exit()
  }

  const rows: Record<string, string>[] = []

  for (const course of courses) {
    rows.push({
      Id: course.id as string,
      Name: course.name as string,
      CreationTime: course.creationTime as string,
      CourseState: course.courseState as string,
    })
  }

  const sortedRows = rows.sort((
    a,
    b,
  ) => (a.CourseState < b.CourseState ? -1 : 1))

  console.table(sortedRows)
}
