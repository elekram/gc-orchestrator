import { Store } from './store.ts'
import { tinyLogger } from './deps.ts'

export function logTasks(store: Store) {
  const logLevel = 'info'
  const fileName = `./log/task-log.csv`
  const type = 'task'

  for (const task of store.tasks.courseCreationTasks) {
    const message = `${task.type} ${task.props.requestBody.id} state ${task.props.requestBody.courseState}`
    tinyLogger.log(type, message, {
      logLevel,
      fileName
    })
  }

  for (const task of store.tasks.courseUpdateTasks) {
    const message = `${task.type} ${task.props.requestBody.id} state ${task.props.requestBody.courseState}`
    tinyLogger.log(type, message, {
      logLevel,
      fileName
    })
  }

  for (const task of store.tasks.courseArchiveTasks) {
    const message = `${task.type} ${task.props.requestBody.id} state ${task.props.requestBody.courseState}`
    tinyLogger.log(type, message, {
      logLevel,
      fileName
    })
  }

  for (const task of store.tasks.enrolmentTasks) {
    const message = `${task.type} ${task.action} ${task.user.userId} course ${task.courseId}`
    tinyLogger.log(type, message, {
      logLevel,
      fileName
    })
  }

  for (const task of store.tasks.courseDeletionTasks) {
    const message = `DELETE course ${task}`
    tinyLogger.log(type, message, {
      logLevel,
      fileName
    })
  }
}