export interface TaskOutcome<T> {
  item: T
  index: number
  success: boolean
  skipped: boolean
  error?: unknown
}

export async function runTasks<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number, total: number) => Promise<void>,
  maxConsecutiveFailures: number,
): Promise<TaskOutcome<T>[]> {
  const total = items.length
  const results: TaskOutcome<T>[] = new Array(total)

  let cursor = 0
  let consecutiveFailures = 0
  let breakerTripped = false

  async function runLane() {
    while (cursor < items.length && !breakerTripped) {
      const index = cursor++
      const item = items[index]

      try {
        await worker(item, index, total)
        consecutiveFailures = 0
        results[index] = { item, index, success: true, skipped: false }
      } catch (error) {
        consecutiveFailures++
        results[index] = { item, index, success: false, skipped: false, error }

        if (consecutiveFailures >= maxConsecutiveFailures) {
          breakerTripped = true
        }
      }
    }
  }

  const laneCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: laneCount }, runLane))

  for (let index = 0; index < items.length; index++) {
    if (!results[index]) {
      results[index] = { item: items[index], index, success: false, skipped: true }
    }
  }

  return results
}
