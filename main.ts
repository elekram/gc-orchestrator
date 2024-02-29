import appSettings from './config/config.ts'
import { Store, store } from './src/store.ts'
import { getToken } from './src/google-jwt-sa.ts'
import { processArgs } from './src/args.ts'
import { addTimetableToStore } from './src/subjects-and-classes.ts'
import testSubjects from './src/test-subjects.ts'
import { addCourseAliasMapToStore, addCoursesToStore } from './src/courses.ts'
import { addUsersToStore } from './src/users.ts'
import * as tasks from './src/tasks.ts'
import * as googleClassroom from './src/google-actions.ts'
import { logTasks } from './src/log-tasks.ts'
import { addDailyOrgReplacementsToStore } from './src/dailyorg.ts'
import { listCourses } from './src/list-courses.ts'
import { parse } from 'std/csv/mod.ts'
import { staging } from './src/staging.ts'

const args = processArgs(Deno.args)

const googleServiceAccountJson = await Deno.readTextFile(
  appSettings.serviceAccountCredentials,
)

store.auth = await getToken(googleServiceAccountJson, {
  scope: appSettings.scopes,
  delegationSubject: appSettings.jwtSubject,
})

if (args.has('--VIEW-COURSE-ALIASES'.toLowerCase())) {
  await addCoursesToStore(store)
  await addCourseAliasMapToStore(store)
  await logTasks(store, 'aliases')
  Deno.exit()
}

if (args.has('--STAGING'.toLowerCase())) {
  addTimetableToStore(store)
  await addCoursesToStore(store)
  await addCourseAliasMapToStore(store)
  tasks.addSubjectCourseTasksToStore(store)
  tasks.addTeacherEnrolmentTasksToStore(store)
  await logTasks(store, 'course')
  await logTasks(store, 'enrolment')
  await staging(store)
  Deno.exit()
}

if (args.has('--DELETE-COURSE'.toLowerCase())) {
  console.log("\n\n\nPlease enter the course alias - example '2023-ENG07A'")
  const input = prompt('\nAlias or Id:')

  if (typeof input === 'string') {
    const alias = input
    await deleteCourse(store, alias)
  }
  Deno.exit()
}

if (args.has('--LIST-COURSES'.toLowerCase())) {
  console.log('\n\n\n%cPlease enter a User Id', 'color:cyan')
  const userId = prompt('\nUser Id:')

  await listCourses(store, userId as string)
  Deno.exit()
}

if (args.has('--TRANSFER-COURSE-OWNERSHIP'.toLowerCase())) {
  await transferCourseOwenership()
  Deno.exit()
}

logCsvFileLocations()
addTimetableToStore(store)

if (appSettings.runDailyorgTasks) {
  const dailyorgFileLocation = appSettings.dailyorgFileLocation
  const teacherReplacementsFile = appSettings.teacherPeriodReplacementsFileName

  const teacherReplacementsCsv = parse(
    await Deno.readTextFile(`${dailyorgFileLocation}${teacherReplacementsFile}`),
    { skipFirstRow: true },
  ) as Record<string, string>[]
  addDailyOrgReplacementsToStore(store, teacherReplacementsCsv)
}

const input = prompt('\nWould you like to continue? (y/n)')

if (input === null || input.toLowerCase() !== 'y') {
  console.log('\n%c[ Script Exiting ]\n', 'color:magenta')
  Deno.exit()
}

if (appSettings.validateSubjectsAndClasses) {
  testSubjects(store)

  const input = prompt('\nWould you like to continue? (y/n)')

  if (input === null || input.toLowerCase() !== 'y') {
    console.log('\n%c[ Script Exiting ]\n', 'color:magenta')
    Deno.exit()
  }
}

if (args.has('--VIEW-SUBJECT'.toLowerCase())) {
  console.log("\n\n\nPlease enter a subject code - example 'ENG07'")
  const input = prompt('\nSubject:')

  if (typeof input === 'string') {
    viewSubejct(input)
  }
  Deno.exit()
}

if (args.has('--VIEW-COMPOSITES'.toLowerCase())) {
  console.log('\n%c[ Composite Classes ]\n', 'color:yellow')
  for (const [key, c] of store.timetable.compositeClasses) {
    console.log(`%c${key}`, 'color:magenta')
    console.log(c)
    console.log('\n')
  }
  Deno.exit()
}

if (args.has('--LOG-ENROLMENT-TASKS'.toLowerCase())) {
  await addUsersToStore(store)
  await addCoursesToStore(store)
  await addCourseAliasMapToStore(store)
  await addTasksToStore(store)

  await logTasks(store, 'enrolment')
  Deno.exit()
}

if (args.has('--LOG-COURSE-TASKS'.toLowerCase())) {
  await addUsersToStore(store)
  await addCoursesToStore(store)
  await addCourseAliasMapToStore(store)
  await addTasksToStore(store)

  await logTasks(store, 'course')
  Deno.exit()
}

if (args.has('--RUN-TASKS'.toLowerCase())) {
  await addUsersToStore(store)
  await addCoursesToStore(store)
  await addCourseAliasMapToStore(store)
  await addTasksToStore(store)
  await runCourseTasks(store)
  await runUpdateAndArchiveTasks(store)
  await runEnrolmentTasks(store)
  await runCourseDeletionTasks(store)
}

async function transferCourseOwenership() {
  console.log('\n\n\n%cPlease enter a course Id or Alias', 'color:cyan')
  const userInput_CourseAliasOrId = prompt('\nCourse alias or Id:')
  console.log(
    `\n\n\n%cPlease enter the UserId to replace ownership for ${userInput_CourseAliasOrId}`,
    'color:cyan',
  )
  const userInput_newCourseOwnerId = prompt('\nUserID:')

  if (typeof userInput_CourseAliasOrId !== 'string') {
    throw 'Course Alias or ID is invalid'
  }

  if (typeof userInput_newCourseOwnerId !== 'string') {
    throw 'Course Alias or ID is invalid'
  }

  await addUsersToStore(store)

  if (!store.remote.activeUsers.has(userInput_newCourseOwnerId.toLowerCase())) {
    throw `User ${userInput_newCourseOwnerId.toLowerCase()} does not exist or is inactive.`
  }

  const currentCourseMembers = await googleClassroom.listCourseMembers(
    store.auth,
    'teachers',
    userInput_CourseAliasOrId,
    0,
    1,
  )

  if (currentCourseMembers && currentCourseMembers.teachers) {
    if (
      !currentCourseMembers.teachers.includes(
        userInput_newCourseOwnerId.toLowerCase(),
      )
    ) {
      const props: googleClassroom.CourseMemberProps = {
        courseId: userInput_CourseAliasOrId,
        type: 'teachers',
        action: 'POST',
        user: {
          userId: userInput_newCourseOwnerId.toLowerCase(),
        },
      }
      await googleClassroom.editCourseMembers(store.auth, props, 0, 1)
    }
  }

  await googleClassroom.changeCourseOwner(
    store.auth,
    userInput_CourseAliasOrId,
    userInput_newCourseOwnerId,
  )
}

async function addTasksToStore(store: Store) {
  if (appSettings.runCourseTasks) {
    await tasks.addTeacherCourseTasksToStore(store)
    await tasks.addClassCourseTasksToStore(store)
    await tasks.addCompositeClassCourseTasksToStore(store)
    await tasks.addSubjectCourseTasksToStore(store)
  }

  if (appSettings.runEnrolmentTasks) {
    await tasks.addTeacherEnrolmentTasksToStore(store)
    await tasks.addStudentEnrolmentTasksToStore(store)
  }

  if (appSettings.runDailyorgTasks) {
    await tasks.addDailyorgEnrolmentTasksToStore(store)
  }

  if (appSettings.runArchiveTasks) {
    await tasks.addCourseArchiveTasksToStore(store)
  }

  if (appSettings.runCourseDeletionTasks) {
    await tasks.addCourseDeletionTasksToStore(store)
  }
}

async function runCourseTasks(store: Store) {
  const tasks = store.tasks.courseCreationTasks

  if (!tasks.length) {
    return
  }

  console.log('\n%c[ Running Course Tasks ]\n', 'color: yellow')

  await Promise.all(
    tasks.map(async (task, index) => {
      await googleClassroom.createCourse(
        store.auth,
        task.props,
        index,
        tasks.length,
      )
    }),
  )
}

async function runUpdateAndArchiveTasks(store: Store) {
  const tasks = [
    ...store.tasks.courseUpdateTasks,
    ...store.tasks.courseArchiveTasks,
  ]

  if (!tasks.length) {
    return
  }

  console.log('\n%c[ Running Update and Archive Tasks ]\n', 'color: yellow')

  await Promise.all(
    tasks.map(async (task, index) => {
      await googleClassroom.updateCourse(
        store.auth,
        task.props,
        index,
        tasks.length,
      )
    }),
  )
}

async function runEnrolmentTasks(store: Store) {
  const tasks = store.tasks.enrolmentTasks

  if (!tasks.length) {
    return
  }

  console.log('\n%c[ Running Enrolment Tasks ]\n', 'color: yellow')

  if (tasks.length) {
    await Promise.all(
      tasks.map(async (task, index) => {
        const props = task

        await googleClassroom.editCourseMembers(
          store.auth,
          props,
          index,
          tasks.length,
        )
      }),
    )
  }
}

async function runCourseDeletionTasks(store: Store) {
  const tasks = store.tasks.courseDeletionTasks

  if (!tasks.length) {
    return
  }

  console.log('\n%c[ Running Deletion Tasks ]\n', 'color: yellow')

  await Promise.all(
    tasks.map(async (task, index) => {
      const props = task

      await googleClassroom.deleteCourse(
        store.auth,
        props,
        index,
        tasks.length,
      )
    }),
  )
}

function viewSubejct(subject: string) {
  // if (!store.timetable.subjects.has(subject.toUpperCase())) {
  //   console.log('%cSubject not found. Exiting.', 'color:red')
  // }

  console.log('\n%cSubject Classes', 'color:magenta')
  for (const [_key, c] of store.timetable.classes) {
    if (c.subjectCode === subject.toUpperCase()) {
      console.log(c)
    }
  }
}

async function deleteCourse(store: Store, alias: string) {
  const auth = store.auth
  const courseId = alias
  const index = 0
  const total = 1

  await googleClassroom.deleteCourse(auth, courseId, index, total)
}

function logCsvFileLocations() {
  console.log(
    `\n%c[ CSV File Location: ${appSettings.csvFileLocation.substring(1)} ]\n`,
    'color:cyan',
  )

  console.log(
    `%c[ Dailyorg File Location: ${appSettings.dailyorgFileLocation.substring(1)} ]`,
    'color:cyan',
  )
}
