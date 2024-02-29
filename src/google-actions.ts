import { GoogleAuth } from './google-jwt-sa.ts'
import appSettings from '../config/config.ts'

export async function listCourseMembers(
  auth: GoogleAuth,
  type: 'students' | 'teachers',
  courseId: string,
  index: number,
  total: number,
) {
  index = index + 1

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(
    `%cFetching ${type} for course ${courseId} - ${index} of ${total} tasks`,
    'color:lightblue',
  )

  let id = `${encodeURIComponent(courseId)}`
  if (isNaN(Number(courseId))) {
    id = encodeURIComponent(`d:${courseId}`)
  }

  const path = 'https://classroom.googleapis.com/v1/courses'
  const pageSize = `pageSize=500`

  let nextPageToken = ''
  const members: string[] = []
  let subtask = false
  do {
    if (subtask) {
      console.log(
        `%cFetching additional ${type} for course ${courseId}.`,
        'color:lightblue',
      )
    }

    const pageToken = `pageToken=${nextPageToken}`
    try {
      const response = await fetch(
        `${path}/${id}/${type}?${pageSize}&${pageToken}`,
        {
          method: 'GET',
          headers: getHeaders(auth),
        },
      )

      const data = await processResponse(response)

      if (!data.responseJson[type]) {
        return {
          courseId,
          [type]: [],
        }
      }

      if (data.responseJson[type]) {
        data.responseJson[type].forEach((member: {
          profile: {
            id: string
            name: {
              givenName: string
              familyName: string
              fullName: string
            }
            emailAddress: string
          }
        }) => {
          if (!('emailAddress' in member.profile)) {
            throw Error('listCourseMembers() emailAddress property missing from member')
          }
          members.push(member.profile.emailAddress)
        })
      }

      nextPageToken = data.responseJson.nextPageToken
      subtask = true
    } catch (e) {
      console.log(e)
      console.log(`Error: listCourseMembers() --> ${courseId} - type: ${type}`)
    }
  } while (nextPageToken)

  return {
    courseId,
    [type]: members,
  }
}

export interface Course {
  id: string
  name: string
  section: string
  description: string
  descriptionHeading: string
  courseState: string
  ownerId: string
  creationTime: string
}

export async function listCourses(
  auth: GoogleAuth,
  type: 'teacherId' | 'studentId',
  userId: string,
): Promise<Course[]> {
  if (!userId) {
    throw 'No User Id'
  }

  const path = 'https://classroom.googleapis.com/v1/courses/'
  const id = `${type}=${encodeURIComponent(userId.toLowerCase())}`
  const pageSize = `pageSize=${appSettings.defaultPageSize}`

  const courses: Course[] = []

  let nextPageToken = ''
  let courseCount = 0

  console.log(
    `%c[ Fetching remote Google Classroom courses for ${userId.toLowerCase()} ]\n`,
    'color:green',
  )

  do {
    const pageToken = `pageToken=${nextPageToken}`

    const response = await fetch(
      `${path}?${id}&${pageSize}&${pageToken}`,
      {
        method: 'GET',
        headers: getHeaders(auth),
      },
    )

    const data = await processResponse(response)
    const responseJson = data.responseJson.courses

    Array.prototype.push.apply(courses, responseJson)

    courseCount = courseCount + data.responseJson.courses.length
    console.log(`%c[ ...${courseCount} courses ]`, 'color:lightblue')

    nextPageToken = data.responseJson.nextPageToken
  } while (nextPageToken)

  console.log(`\n%c[ ${courseCount} total courses fetched ]\n`, 'color:cyan')
  return courses
}

export async function createCourseAlias(
  auth: GoogleAuth,
  courseId: string,
  alias: string,
  index: number,
  total: number,
) {
  index = index + 1
  const baseUrl = 'https://classroom.googleapis.com/v1/courses'
  const requestUrl = `${baseUrl}/${courseId}/aliases`

  const body = JSON.stringify({
    alias: `d:${alias}`,
  })

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(
    `%cAdding alias ${alias} to course ${courseId} - ${index} of ${total} tasks`,
    'color:lightblue',
  )

  try {
    const response = await fetch(
      requestUrl,
      {
        method: 'POST',
        headers: getHeaders(auth),
        body,
      },
    )
    const data = await processResponse(response)
    console.log(
      `%c[ Alias ${alias} created for course ${courseId} - Status ${data.status} ]\n`,
      'color:green',
    )
  } catch (e) {
    const errorSource = `Error: createCourseAlias() ${courseId}`
    console.log(`%c${errorSource} - ${e.code} ${e.message}`, 'color:red')
    console.log('Script must exit if alias cannot be created')
    Deno.exit(1)
  }
}

export async function deleteCourseAlias(
  auth: GoogleAuth,
  courseId: string,
  alias: string,
  index: number,
  total: number,
) {
  index = index + 1
  const encodedAlias = encodeURIComponent(`d:${alias}`)
  const baseUrl = 'https://classroom.googleapis.com/v1/courses'
  const requestUrl = `${baseUrl}/${courseId}/aliases/${encodedAlias}`

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(
    `%cDeleting alias ${alias} for course ${courseId} - ${index} of ${total} tasks`,
    'color:lightblue',
  )

  try {
    const response = await fetch(
      requestUrl,
      {
        method: 'DELETE',
        headers: getHeaders(auth),
      },
    )
    const data = await processResponse(response)
    console.log(
      `%c[ Alias ${alias} deleted for course ${courseId} - Status ${data.status} ]\n`,
      'color:green',
    )
  } catch (e) {
    const errorSource = `Error: deleteCourseAlias() ${courseId} - ${alias}`
    console.log(`%c${errorSource} - ${e.code} ${e.message}`, 'color:red')
    console.log('Script must exit if alias cannot be created')
    Deno.exit(1)
  }
}

export async function getCourseAliases(
  auth: GoogleAuth,
  courseId: string,
  index: number,
  total: number,
) {
  index = index + 1
  const id = `${encodeURIComponent(courseId)}`

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(
    `%cFetching alias for course ${courseId} - ${index} of ${total} tasks`,
    'color:lightblue',
  )

  const response = await fetch(
    `https://classroom.googleapis.com/v1/courses/${id}/aliases`,
    {
      method: 'GET',
      headers: getHeaders(auth),
    },
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
    aliases,
  }
}

export interface CourseMemberProps {
  courseId: string
  type: 'teachers' | 'students'
  action: 'POST' | 'DELETE'
  user: {
    userId: string
  }
}

export async function editCourseMembers(
  auth: GoogleAuth,
  props: CourseMemberProps,
  index: number,
  total: number,
) {
  index = index + 1
  const type = props.type
  const method = props.action
  const member = props.user.userId
  const encodedMember = `${encodeURIComponent(`${props.user.userId}`)}`
  const verb = props.action === 'POST' ? 'to' : 'from'

  let id = `${encodeURIComponent(props.courseId)}`
  if (isNaN(Number(props.courseId))) {
    id = `d:${encodeURIComponent(props.courseId)}`
  }

  let body = ''

  const baseUrl = 'https://classroom.googleapis.com/v1/courses'
  let requestUrl = ''

  switch (props.action) {
    case 'POST':
      requestUrl = `${baseUrl}/${id}/${type}`
      body = JSON.stringify(props.user)
      break

    case 'DELETE':
      requestUrl = `${baseUrl}/${id}/${type}/${encodedMember}`
      break
  }

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(
    `%c${method} ${
      type.slice(0, -1)
    } ${member} ${verb} course ${props.courseId} - ${index} of ${total} tasks`,
    'color:lightblue',
  )

  try {
    const response = await fetch(
      requestUrl,
      {
        method,
        headers: getHeaders(auth),
        body,
      },
    )
    const data = await processResponse(response)
    console.log(
      `%c[ ${method} ${member} ${verb} ${props.courseId} - Status ${data.status} ]\n`,
      'color:green',
    )
  } catch (e) {
    const errorSource = `Error: editCourseMembers() ${props.courseId} - ${member}`
    console.log(`%c${errorSource} - ${e.code} ${e.message}`, 'color:red')
  }
}

export interface CourseProps {
  updateMask: string | undefined // 'name,section,description,descriptionHeading,room,courseState, ownerId'
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
  props: CourseProps,
  index: number,
  total: number,
) {
  index = index + 1

  const courseId = props.requestBody.id
  props.requestBody.id = `d:${props.requestBody.id}`

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(`Creating course: ${courseId} - ${index} of ${total} tasks`)

  const body = JSON.stringify(props.requestBody)

  try {
    const response = await fetch(
      `https://classroom.googleapis.com/v1/courses`,
      {
        method: 'POST',
        headers: getHeaders(auth),
        body,
      },
    )
    const data = await processResponse(response)
    console.log(
      `%c[ Created course ${courseId} - Status ${data.status} ]\n`,
      'color:green',
    )
  } catch (e) {
    const errorSource = `Error: createCourse() ${courseId}`
    console.log(`%c${errorSource} - ${e.code} ${e.message}`, 'color:red')
    console.log('Script must exit if course cannot be created')
    Deno.exit(1)
  }
}

export async function updateCourse(
  auth: GoogleAuth,
  props: CourseProps,
  index: number,
  total: number,
) {
  index = index + 1
  const courseId = `${props.requestBody.id}`
  const updateMask = `updateMask=${props.updateMask}`
  const body = JSON.stringify(props.requestBody)

  const path = 'https://classroom.googleapis.com/v1/courses'

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(`\nPatching course ${courseId} - ${index} of ${total} tasks`)

  try {
    const response = await fetch(
      `${path}/d:${courseId}/?${updateMask}`,
      {
        method: 'PATCH',
        headers: getHeaders(auth),
        body,
      },
    )

    const data = await processResponse(response)
    console.log(
      `%c[ Patched course: ${courseId} - ${data.status} ]\n`,
      'color:green',
    )
  } catch (e) {
    const errorSource = `Error: updateCourse() ${courseId}`
    console.log(`%c${errorSource} - ${e.code} ${e.message}`, 'color:red')
  }
}

export async function deleteCourse(
  auth: GoogleAuth,
  courseId: string,
  index: number,
  total: number,
) {
  index = index + 1

  let id = `${encodeURIComponent(courseId)}`
  if (isNaN(Number(courseId))) {
    id = `d:${encodeURIComponent(courseId)}`
  }

  const path = 'https://classroom.googleapis.com/v1/courses'

  const delay = index * appSettings.taskDelay
  await sleep(delay)

  console.log(`Deleting course: ${courseId} - ${index} of ${total} tasks`)

  const response = await fetch(
    `${path}/${id}`,
    {
      method: 'DELETE',
      headers: getHeaders(auth),
    },
  )

  const data = await processResponse(response)
  console.log(
    `%c[ Deleted course ${courseId} - Status ${data.status} ]\n`,
    'color:green',
  )
}

export async function changeCourseOwner(
  auth: GoogleAuth,
  courseId: string,
  newOwner: string,
) {
  let id = `${encodeURIComponent(courseId)}`
  if (isNaN(Number(courseId))) {
    id = `d:${encodeURIComponent(courseId)}`
  }

  const updateMask = 'updateMask=ownerId'
  const path = 'https://classroom.googleapis.com/v1/courses'

  const body = JSON.stringify({
    ownerId: newOwner,
  })

  console.log(`\nPatching course ${courseId}`)

  const response = await fetch(
    `${path}/${id}/?${updateMask}`,
    {
      method: 'PATCH',
      headers: getHeaders(auth),
      body,
    },
  )

  const data = await processResponse(response)
  console.log(
    `%c[ Changed owner for ${courseId} to ${newOwner} - ${data.status} ]\n`,
    'color:green',
  )
}

export async function listDirectoryUsers(
  auth: GoogleAuth,
) {
  const domain = `domain=${encodeURIComponent('cheltsec.vic.edu.au')}`
  const path = 'https://admin.googleapis.com/admin/directory/v1/users'
  const maxResults = `maxResults=500`

  let nextPageToken = ''
  let userCount = 0
  const activeUsers: Set<string> = new Set()
  const suspendedUsers: Set<string> = new Set()

  console.log(
    `\n%c[ Fetching Google Admin Directory Users for ${appSettings.domain} ]\n`,
    'color:green',
  )

  do {
    const pageToken = `pageToken=${nextPageToken}`

    const response = await fetch(
      `${path}/?${domain}&${maxResults}&${pageToken}`,
      {
        method: 'GET',
        headers: getHeaders(auth),
      },
    )
    const data = await processResponse(response)

    interface GoogleUser {
      primaryEmail: string
      suspended: boolean
      isAdmin: boolean
    }

    data.responseJson.users.forEach((e: GoogleUser) => {
      const username = e.primaryEmail
      const isSuspended = e.suspended
      const isAdmin = e.isAdmin

      if (!isAdmin && !isSuspended) {
        activeUsers.add(username)
      }

      if (!isAdmin && isSuspended) {
        suspendedUsers.add(username)
      }
    })

    userCount = userCount + data.responseJson.users.length
    console.log(`%c[ ...${userCount} users ]`, 'color:lightblue')

    nextPageToken = data.responseJson.nextPageToken
  } while (nextPageToken)

  console.log(`\n%c[ ${userCount} total users fetched ]\n`, 'color:cyan')

  return { activeUsers, suspendedUsers }
}

async function processResponse(r: Response) {
  if (!r.ok) {
    const responseJson = await r.json()
    throw responseJson.error
  }
  const status = `${r.status}: ${r.statusText}`
  const responseJson = await r.json()

  return { status, responseJson }
}

function getHeaders(auth: GoogleAuth) {
  return {
    'authorization': `Bearer ${auth.access_token}`,
    'content-type': 'application/json',
    'accept': 'application/json',
  }
}

function sleep(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay))
}
