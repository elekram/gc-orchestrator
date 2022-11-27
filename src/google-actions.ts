import { GoogleAuth } from './google-jwt-sa.ts'
import appSettings from '../config/config.ts'

export const googleClassroom = {
  async listCourseStudent(auth: GoogleAuth, courseId: string) {
    const path = 'https://classroom.googleapis.com/v1/courses/'
    const id = `d:${encodeURIComponent(courseId)}`

    const response = await fetch(
      `${path}${id}/students`,
      {
        method: 'GET',
        headers: this.headers(auth)
      }
    )

    const data = await this.processResponse(response)
    return data
  },

  async listCourses(
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

    console.log(`\n[ Fetching remote Google Classroom Courses for ${appSettings.classadmin} ]`)

    do {
      const pageToken = `pageToken=${nextPageToken}`

      const response = await fetch(
        `${path}?${id}&${pageSize}&${pageToken}`,
        {
          method: 'GET',
          headers: this.headers(auth)
        }
      )

      const data = await this.processResponse(response)

      Array.prototype.push.apply(courses, data.courses)
      courseCount = courseCount + data.courses.length

      console.log(`[ ${courseCount} courses... ]`)
      nextPageToken = data.nextPageToken
    } while (nextPageToken)
    console.log(`\n[ ${courseCount} total courses ]`)
    // console.log(courses)

    return courses
  },

  async getCourseAliases(auth: GoogleAuth, courseId: string, index: number, total: number) {
    const id = `${encodeURIComponent(courseId)}`
    index = index || 0
    total = total || 0

    index = index + 1

    const delay = index * appSettings.taskDelay
    await this.sleep(delay)

    const response = await fetch(
      `https://classroom.googleapis.com/v1/courses/${id}/aliases`,
      {
        method: 'GET',
        headers: this.headers(auth)
      }
    )
    const data = await this.processResponse(response)

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
  },

  async processResponse(r: Response) {
    if (!r.ok) {
      const jsonData = await r.json()
      throw jsonData
    }
    const jsonData = await r.json()
    // console.log(jsonData)
    return jsonData
  },

  headers(auth: GoogleAuth) {
    return {
      "authorization": `Bearer ${auth.access_token}`,
      "content-type": "application/json",
      "accept": "application/json"
    }
  },

  sleep(delay: number) {
    return new Promise(resolve => setTimeout(resolve, delay))
  }
}