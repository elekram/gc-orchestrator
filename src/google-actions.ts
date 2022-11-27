import { GoogleAuth } from './google-jwt-sa.ts'
import appSettings from '../config/config.ts'

export async function listCourseMembers(
  auth: GoogleAuth,
  type: 'students' | 'teachers',
  courseId: string,
  index: number,
  total: number
) {
  const path = 'https://classroom.googleapis.com/v1/courses/'
  const id = `d:${encodeURIComponent(courseId)}`

  const response = await fetch(
    `${path}${id}/${type}`,
    {
      method: 'GET',
      headers: getHeaders(auth)
    }
  )

  const data = await processResponse(response)
  console.log(data)
  const members = new Set()
  if (data[type]) {
    data[type].forEach((member: Record<string, unknown>) => {
      const memberProfile = member.profile as Record<string, string>
      members.add(memberProfile.emailAddress)
    })
  }
  return members
}

export async function listCourses(
  auth: GoogleAuth,
  type: 'teacherId' | 'studentId',
  userId: string
) {
  const path = 'https://classroom.googleapis.com/v1/courses/'
  const id = `${type}=${encodeURIComponent(userId)}`
  const pageSize = `pageSize=${appSettings.defaultPageSize}`

  const courses: Record<string, unknown>[] = []

  let nextPageToken = ''
  let courseCount = 0

  console.log(`\n%c[ Fetching remote Google Classroom courses for ${appSettings.classadmin} ]\n`, 'color:green')

  do {
    const pageToken = `pageToken=${nextPageToken}`

    const response = await fetch(
      `${path}?${id}&${pageSize}&${pageToken}`,
      {
        method: 'GET',
        headers: getHeaders(auth)
      }
    )

    const data = await processResponse(response)

    Array.prototype.push.apply(courses, data.courses)

    courseCount = courseCount + data.courses.length
    console.log(`%c[ ...${courseCount} courses ]`, 'color:lightblue')

    nextPageToken = data.nextPageToken
  } while (nextPageToken)
  console.log(`\n%c[ ${courseCount} total courses fetched ]\n`, 'color:cyan')

  return courses
}

export async function getCourseAliases(auth: GoogleAuth, courseId: string, index: number, total: number) {
  const id = `${encodeURIComponent(courseId)}`
  index = index || 0
  total = total || 0

  index = index + 1

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  const response = await fetch(
    `https://classroom.googleapis.com/v1/courses/${id}/aliases`,
    {
      method: 'GET',
      headers: getHeaders(auth)
    }
  )
  const data = await processResponse(response)

  const aliases: string[] = []
  if (data.aliases && data.aliases.length) {
    data.aliases.forEach((e) => {
      aliases.push(e.alias)
    })
  }

  console.log(`Fetching aliase for course: ${courseId} ${index} of ${total} tasks`)
  return {
    id: courseId,
    aliases
  }
}

async function processResponse(r: Response) {
  if (!r.ok) {
    const jsonData = await r.json()
    throw jsonData
  }
  const jsonData = await r.json()
  return jsonData
}

function getHeaders(auth: GoogleAuth) {
  return {
    "authorization": `Bearer ${auth.access_token}`,
    "content-type": "application/json",
    "accept": "application/json"
  }
}

function sleep(delay: number) {
  return new Promise(resolve => setTimeout(resolve, delay))
}
