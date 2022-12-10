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
  const id = encodeURIComponent(`d:${courseId}`)

  if (index > 1) {
    index = index + 1
  }

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(`%cFetching ${type} for course ${courseId} - ${index} of ${total} tasks`, 'color:lightblue')

  const response = await fetch(
    `${path}${id}/${type}`,
    {
      method: 'GET',
      headers: getHeaders(auth)
    }
  )
  const data = await processResponse(response)

  const members: string[] = []

  if (data.responseJson[type]) {
    data.responseJson[type].forEach((member: Record<string, unknown>) => {
      const memberProfile = member.profile as Record<string, string>
      members.push(memberProfile.emailAddress)
    })
  }

  return {
    courseId,
    [type]: members
  }
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

    Array.prototype.push.apply(courses, data.responseJson.courses)

    courseCount = courseCount + data.responseJson.courses.length
    console.log(`%c[ ...${courseCount} courses ]`, 'color:lightblue')

    nextPageToken = data.responseJson.nextPageToken
  } while (nextPageToken)
  console.log(`\n%c[ ${courseCount} total courses fetched ]\n`, 'color:cyan')

  return courses
}

export async function getCourseAliases(
  auth: GoogleAuth,
  courseId: string,
  index: number,
  total: number
) {
  const id = `${encodeURIComponent(courseId)}`

  if (index > 1) {
    index = index + 1
  }

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(`%cFetching alias for course ${courseId} - ${index} of ${total} tasks`, 'color:lightblue')

  const response = await fetch(
    `https://classroom.googleapis.com/v1/courses/${id}/aliases`,
    {
      method: 'GET',
      headers: getHeaders(auth)
    }
  )
  const data = await processResponse(response)

  const aliases: string[] = []
  if (data.responseJson.aliases && data.responseJson.aliases.length) {
    data.responseJson.aliases.forEach((e: { alias: string }) => {
      aliases.push(e.alias.substring(2).trim())
    })
  }

  return {
    id: courseId,
    aliases
  }
}

interface CourseMemberProps {
  courseId: string
  type: 'teachers' | 'students'
  user: {
    userId: string
  }
}

export async function addCourseMember(
  auth: GoogleAuth,
  props: CourseMemberProps,
  index: number,
  total: number
) {
  if (index > 1) {
    index = index + 1
  }

  const type = props.type
  const courseId = `${encodeURIComponent(`d:${props.courseId}`)}`
  const userId = props.user.userId

  const path = 'https://classroom.googleapis.com/v1/courses'
  const body = JSON.stringify(props.user)

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(`%cAdding ${type.slice(0, -1)} ${userId} to course ${props.courseId} - ${index} of ${total} tasks`, 'color:lightblue')

  const response = await fetch(
    `${path}/${courseId}/${type}`, {
    method: 'POST',
    headers: getHeaders(auth),
    body
  })
  const data = await processResponse(response)
  console.log(`%c[ ${userId} to ${props.courseId} - Status ${data.status} ]\n`, 'color:green')
}

interface RemoveMemberProps {
  type: 'students' | 'teachers'
  courseId: string
  userId: string
}

export async function removeCourseMember(
  auth: GoogleAuth,
  props: RemoveMemberProps,
  index: number,
  total: number
) {
  if (index > 1) {
    index = index + 1
  }

  const type = props.type
  const id = `${encodeURIComponent(`d:${props.courseId}`)}`
  const member = encodeURIComponent(props.userId)
  const path = 'https://classroom.googleapis.com/v1/courses'

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(`%cRemoving ${props.type.slice(0, -1)} ${props.userId} to course ${props.courseId} - ${index} of ${total} tasks`, 'color:lightblue')

  const response = await fetch(
    `${path}/${id}/${type}/${member}`, {
    method: 'DELETE',
    headers: getHeaders(auth),
  })
  const data = await processResponse(response)
  console.log(`%c[ ${props.userId} from ${props.courseId} - Status ${data.status} ]\n`, 'color:green')
}

interface CreateCourseProps {
  requestBody: {
    id: string
    name: string
    section: string
    description: string
    descriptionHeading: string
    courseState: string
    ownerId: string
  }
}

export async function createCourse(
  auth: GoogleAuth,
  props: CreateCourseProps,
  index: number,
  total: number
) {
  const courseId = props.requestBody.id
  props.requestBody.id = `d:${props.requestBody.id}`

  index = index || 0
  total = total || 0

  index = index + 1

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(`Creating course: ${courseId} - ${index} of ${total} tasks`)

  const body = JSON.stringify(props.requestBody)

  const response = await fetch(
    `https://classroom.googleapis.com/v1/courses`, {
    method: 'POST',
    headers: getHeaders(auth),
    body
  })
  const data = await processResponse(response)
  console.log(data,)
}

interface UpdateCourseProps {
  courseId: string
  updateMask: string // 'name,section,description,descriptionHeading,room,courseState, ownerId'
  requestBody: {
    name: string
    section: string
    description: string
    descriptionHeading: string
    courseState: string
    ownerId?: string
  }
}

export async function updateCourse(
  auth: GoogleAuth,
  props: UpdateCourseProps,
  index: number,
  total: number
) {
  index = index || 0
  total = total || 0

  index = index + 1

  const courseId = `${props.courseId}`
  const updateMask = `updateMask=${props.updateMask}`
  const body = JSON.stringify(props.requestBody)

  const path = 'https://classroom.googleapis.com/v1/courses'

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(`Patching course properties for ${courseId} - ${index} of ${total} tasks`)

  const response = await fetch(
    `${path}/d:${courseId}/?${updateMask}`, {
    method: 'PATCH',
    headers: getHeaders(auth),
    body
  })

  const data = await processResponse(response)
  console.log(`%c[ Patch course: ${courseId} - ${data.status} ]\n`, 'color:green')
}

async function processResponse(r: Response) {
  if (!r.ok) {
    const responseJson = await r.json()
    throw responseJson
  }
  const status = `${r.status}: ${r.statusText}`
  const responseJson = await r.json()

  return { status, responseJson }
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
