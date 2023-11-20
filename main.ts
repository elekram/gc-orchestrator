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

const args = processArgs(Deno.args)

const googleServiceAccountJson = await Deno.readTextFile(
  appSettings.serviceAccountCredentials,
)

store.auth = await getToken(googleServiceAccountJson, {
  scope: appSettings.scopes,
  delegationSubject: appSettings.jwtSubject,
})

addTimetableToStore(store)

if (args.has('--VIEW-SUBJECT'.toLowerCase())) {
  console.log('\n\n\nPlease enter a subject code - example \'ENG07\'')
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

if (appSettings.validateSubjectsAndClasses) {
  testSubjects(store)
  const input = prompt('\nWould you like to continue? (y/n)')

  if (input === null || input.toLowerCase() !== 'y') {
    console.log('\n%c[ Script Exiting ]\n', 'color:magenta')
    Deno.exit()
  }
}

await addUsersToStore(store)
await addCoursesToStore(store)
await addCourseAliasMapToStore(store)

if (args.has('--VIEW-ALIASES'.toLowerCase())) {
  await logTasks(store, 'aliases')
  Deno.exit()
}

if (appSettings.runCourseTasks) {
  await tasks.addSubjectTasksToStore(store)
  await tasks.addClassTasksToStore(store)
  await tasks.addCompositeClassTasksToStore(store)
}

if (appSettings.runEnrolmentTasks) {
  await tasks.addTeacherEnrolmentTasksToStore(store)
  await tasks.addStudentEnrolmentTasksToStore(store)
}

if (appSettings.runArchiveTasks) {
  await tasks.addCourseArchiveTasksToStore(store)
}

if (appSettings.runCourseDeletionTasks) {
  await tasks.addCourseDeletionTasksToStore(store)
}

if (args.has('--LOG-ENROLMENT-TASKS'.toLowerCase())) {
  await logTasks(store, 'enrolment')
  Deno.exit()
}

if (args.has('--LOG-COURSE-TASKS'.toLowerCase())) {
  await logTasks(store, 'course')
  Deno.exit()
}

if (args.has('--RUN-TASKS'.toLowerCase())) {
  await runCourseTasks(store)
  await runUpdateAndArchiveTasks(store)
  await runEnrolmentTasks(store)
  await runCourseDeletionTasks(store)
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
  if (!store.timetable.subjects.has(subject.toUpperCase())) {
    console.log('%cSubject not found. Exiting.', 'color:red')
  }
  const s = store.timetable.subjects.get(subject.toUpperCase())
  console.log('\n%cSubject', 'color:cyan')
  if (s) {
    console.log(s)
  }

  console.log('\n%cSubject Classes', 'color:magenta')
  for (const [_key, c] of store.timetable.classes) {
    if (c.subjectCode === subject.toUpperCase()) {
      console.log(c)
    }
  }
}
