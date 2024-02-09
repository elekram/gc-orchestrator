import appSettings from '../config/config.ts'
import { Store } from './store.ts'
import { Column, stringify } from 'std/csv/mod.ts'
import { format } from 'std/datetime/mod.ts'

export async function logTasks(store: Store, type: 'enrolment' | 'course' | 'aliases') {
  let t = '-tasks'
  if (type === 'aliases') {
    t = ''
  }

  const path = `${appSettings.logLocation}${type}${t}-${
    format(new Date(), 'yyyy-MM-dd_HH-mm-ss')
  }.csv`

  const file = Deno.openSync(path, {
    read: true,
    write: true,
    create: true,
    append: true,
  })

  const rows: Record<string, unknown>[] = []
  let columns: Column[] = []

  switch (type.toLocaleLowerCase()) {
    case 'course':
      {
        columns = [
          'TaskType',
          'RemoteAlias',
          'ClassCode',
        ]

        store.tasks.courseArchiveTasks.forEach((c) => {
          rows.push({
            TaskType: c.type.toUpperCase(),
            RemoteAlias: c.props.requestBody.id,
            ClassCode: c.props.requestBody.name,
          })
        })

        store.tasks.courseCreationTasks.forEach((c) => {
          rows.push({
            TaskType: c.type.toUpperCase(),
            RemoteAlias: c.props.requestBody.id,
            ClassCode: c.props.requestBody.name,
          })
        })

        store.tasks.courseUpdateTasks.forEach((c) => {
          rows.push({
            TaskType: c.type.toUpperCase(),
            RemoteAlias: c.props.requestBody.id,
            ClassCode: c.props.requestBody.name,
          })
        })

        store.tasks.courseDeletionTasks.forEach((c) => {
          rows.push({
            TaskType: 'DELETE',
            RemoteAlias: c,
            ClassCode: c,
          })
        })
      }

      break
    case 'enrolment':
      {
        columns = [
          'TaskType',
          'User',
          'Course',
        ]

        store.tasks.enrolmentTasks.forEach((task) => {
          rows.push({
            TaskType: task.action,
            User: task.user,
            Course: task.courseId,
          })
        })
      }
      break
    case 'aliases': {
      columns = [
        'Alias',
        'Id',
      ]

      for (const [alias, id] of store.remote.courseAliases) {
        rows.push({
          Alias: alias,
          Id: id,
        })
      }
    }
  }

  const dataRows = stringify(rows, { columns, headers: true })

  const fileWriter = file.writable.getWriter()
  await fileWriter.ready

  const encoder = new TextEncoder()
  const encodedData = encoder.encode(dataRows)

  await fileWriter.write(encodedData)
  await fileWriter.close()

  console.table(rows)
  console.log(`\nTasks logged to ${path}\n`)
}
