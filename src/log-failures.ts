import appSettings from '../config/config.ts'
import { Column, stringify } from 'std/csv/mod.ts'
import { format } from 'std/datetime/mod.ts'
import { TaskOutcome } from './task-runner.ts'

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  if (error && typeof error === 'object') {
    const e = error as { message?: string; status?: string }
    if (e.message) return e.message
    if (e.status) return e.status
    return JSON.stringify(error)
  }

  return String(error)
}

export async function logFailures<T>(
  type: string,
  outcomes: TaskOutcome<T>[],
  describe: (item: T) => string,
) {
  const failures = outcomes.filter((outcome) => !outcome.success)
  if (!failures.length) return

  const path = `${appSettings.logLocation}${type}-failures-${
    format(new Date(), 'yyyy-MM-dd_HH-mm-ss')
  }.csv`

  const rows = failures.map((outcome) => ({
    Task: describe(outcome.item),
    Status: outcome.skipped ? 'SKIPPED' : 'FAILED',
    Error: outcome.skipped ? 'circuit breaker tripped' : describeError(outcome.error),
  }))

  const columns: Column[] = ['Task', 'Status', 'Error']

  const file = Deno.openSync(path, {
    read: true,
    write: true,
    create: true,
    append: true,
  })

  const dataRows = stringify(rows, { columns, headers: true })

  const fileWriter = file.writable.getWriter()
  await fileWriter.ready

  const encoder = new TextEncoder()
  const encodedData = encoder.encode(dataRows)

  await fileWriter.write(encodedData)
  await fileWriter.close()

  console.log(`\n%c[ ${failures.length} failure(s) logged to ${path} ]\n`, 'color:red')
}
