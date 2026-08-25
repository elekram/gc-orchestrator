export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number, total: number) => Promise<R>,
): Promise<R[]> {
  const total = items.length
  const results: R[] = new Array(total)

  let cursor = 0

  async function runLane() {
    while (cursor < total) {
      const index = cursor++
      results[index] = await worker(items[index], index, total)
    }
  }

  const laneCount = Math.min(concurrency, total)
  await Promise.all(Array.from({ length: laneCount }, runLane))

  return results
}
