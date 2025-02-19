import appSettings from './config/config.ts'
import enrolmentExceptions from './config/enorolment-exceptions.ts'
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

store.enrolmentExceptions.teacherExceptions = enrolmentExceptions.teacherExceptions
store.enrolmentExceptions.studentExceptions = enrolmentExceptions.studentExceptions

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
  await addTasksToStore(store)
  await logTasks(store, 'course')
  await logTasks(store, 'enrolment')
  await staging(store)
  Deno.exit()
}

if (args.has('--SCRATCH'.toLowerCase())) {
  Deno.exit()
}

function isNumeric(value: string) {
  return /^[0-9]+$/.test(value)
}

if (args.has('--COURSE-MEMBER'.toLowerCase())) {
  console.log("\n\n%c[ Please enter the course alias - example '7ENGA' ]", 'color:green')
  const courseAliasInput = prompt('\nCourse Alias:')
  let alias = ''
  if (typeof courseAliasInput === 'string') {

    await addCourseAliasMapToStore(store)

    let foundMatch = false
    for (const [courseAlias, _] of store.remote.courseAliases) {
      const aliasParts = courseAlias.split('.')
      const courseType = aliasParts[1]
      const code = aliasParts[2].toUpperCase()

      if (code === courseAliasInput.toUpperCase()) {
        foundMatch = true
        switch (courseType) {
          case tasks.CourseType.TeacherCourse: {
            alias = `${appSettings.aliasVersion}.${courseType}.${code}`
            break
          }
          case tasks.CourseType.ClassCourse: {
            const year = tasks.getAcademicYearForClasscode(courseAliasInput)
            alias = `${appSettings.aliasVersion}.${courseType}.${code}.${year}`
            break
          }
          default:
            console.log("%cError. Must exit", 'color:red')
            Deno.exit()
        }
      }
    }
    if (!foundMatch) {
      console.log("%cNo course found for: " + courseAliasInput + "", 'color:red')
      console.log("%cScript must exit!\n", 'color:yellow')
      Deno.exit()
    }
  }

  console.log(`%cCourse Identifier: ${alias}`, 'color:yellow')

  console.log(`\n%c[ Choose an Option ]`, 'color:green')

  console.log(`\n%c1: Add Student to ${alias}? `, 'color:cyan')
  console.log(`%c2: Remove Student from ${alias}? `, 'color:cyan')
  console.log(`%c3: Add Teacher to ${alias}? `, 'color:magenta')
  console.log(`%c4: Remove Teacher from ${alias}? `, 'color:magenta')
  const actionTypeInput = prompt('\nChoose option [1,2,3,4]:')

  let type = ''
  let method = ''
  let userInput

  if (typeof actionTypeInput === 'string') {
    switch (actionTypeInput) {
      case '1':
        type = 'students'
        method = 'POST'
        console.log('%c\nStudent User Id to add?', 'color:yellow')
        userInput = prompt('Student [example AAA0001]:')
        break
      case '2':
        type = 'students'
        method = 'DELETE'
        console.log('\n%cStudent User Id to remove?', 'color:yellow')
        userInput = prompt('Student [example AAA0001]:')
        break
      case '3':
        type = 'teachers'
        method = 'POST'
        console.log('\n%cTeacher User Id to add?', 'color:yellow')
        userInput = prompt('Teacher [example lee or bmc]:')
        break
      case '4':
        type = 'teachers'
        method = 'DELETE'
        console.log('\n%cTeacher User Id to remove?', 'color:yellow')
        userInput = prompt('Teacher [example lee or bmc]:')
        break
      default:
        console.log("\nInvalid option. Exiting.\n\n")
        Deno.exit()
    }
  }

  await addUsersToStore(store)

  if (!userInput) {
    console.log("no useer entered. exiting")
    Deno.exit()
  }

  const userId = `${userInput.toLowerCase()}${appSettings.domain}`

  if (!store.remote.activeUsers.has(`${userInput.toLowerCase()}${appSettings.domain}`)) {
    console.log("\nUser not found: " + userId + "\n\n")
    Deno.exit()
  }

  await googleClassroom.addRemoveCourseMember(
    store.auth,
    type,
    userId,
    alias,
    method
  )

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
    console.log(`% c${key} `, 'color:magenta')
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
    `\n\n\n % cPlease enter the UserId to replace ownership for ${userInput_CourseAliasOrId}`,
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

  await Deno.writeTextFile(appSettings.cacheStateFile, JSON.stringify({ isCacheValid: false }));
  console.log(
    `\n % c[Cache is now expired ]\n`,
    'color:red',
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

  await Deno.writeTextFile(appSettings.cacheStateFile, JSON.stringify({ isCacheValid: false }));
  console.log(
    `\n % c[Cache is now expired ]\n`,
    'color:red',
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

  await Deno.writeTextFile(appSettings.cacheStateFile, JSON.stringify({ isCacheValid: false }));
}

function logCsvFileLocations() {
  console.log(
    `\n%c[ CSV File Location: ${appSettings.csvFileLocation.substring(1)} ]\n`,
    'color:cyan',
  )

  console.log(
    `%c[ Dailyorg File Location: ${appSettings.dailyorgFileLocation.substring(1)} ]\n`,
    'color:cyan',
  )

  console.log(
    `%c[ Cache File Location: ${appSettings.cacheFile.substring(1)} ]\n`,
    'color:purple',
  )

  console.log(
    `%c[ Cache State File: ${appSettings.cacheStateFile.substring(1)} ]`,
    'color:purple',
  )
}
