import { store, Store } from './src/store.ts'
import { getToken } from './src/google-jwt-sa.ts'
import { processArgs } from './src/args.ts'
import appSettings from './config/config.ts'
import { logTasks } from './src/log.ts'
import { addTimetableToStore } from './src/subjects-and-classes.ts'
import testSubjects from './src/test-subjects.ts'
import { addCourseAliasMapToStore, addCoursesToStore } from './src/courses.ts'
import * as tasks from './src/tasks.ts'
import * as googleClassroom from './src/google-actions.ts'
import { TinyLogger } from 'https://deno.land/x/tiny_logger@v1.0.12/mod.ts'

const args = processArgs(Deno.args)

const googleServiceAccountJson = await Deno.readTextFile(
  appSettings.serviceAccountCredentials
)

store.auth = await getToken(googleServiceAccountJson, {
  scope: appSettings.scopes,
  delegationSubject: appSettings.jwtSubject
})

addTimetableToStore(store)
testSubjects(store)

const input = prompt('\nWould you like to continue? (y/n)')

if (input === null || input.toLowerCase() !== 'y') {
  console.log('\n%c[ Script Exiting ]\n', 'color:magenta')
  Deno.exit()
}

await addCoursesToStore(store)
await addCourseAliasMapToStore(store)

if (args.has('--SHOW-ALIASES'.toLowerCase())) {
  for (const [k, v] of store.remote.courseAliases) {
    console.log(`%c${k} --> ${v}`, 'color:green')
  }
  Deno.exit()
}

await tasks.addSubjectTasksToStore(store)
await tasks.addClassTasksToStore(store)
await tasks.addCompositeClassTasksToStore(store)
await tasks.addTeacherEnrolmentTasksToStore(store)
await tasks.addStudentEnrolmentTasksToStore(store)
await tasks.addCourseArchiveTasksToStore(store)
await tasks.addCourseDeletionTasksToStore(store)

if (args.has('--SHOW-TASKS'.toLowerCase())) {
  logTasks(store)
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
        tasks.length
      )
    })
  )

}

async function runUpdateAndArchiveTasks(store: Store) {
  const tasks = [
    ...store.tasks.courseUpdateTasks,
    ...store.tasks.courseArchiveTasks
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
        tasks.length
      )
    })
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
          tasks.length
        )
      })
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
        tasks.length
      )
    })
  )
}

