import { assertEquals } from 'https://deno.land/std@0.205.0/assert/mod.ts'
import { runTasks } from './task-runner.ts'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

Deno.test('runTasks never exceeds the configured concurrency', async () => {
  let inFlight = 0
  let peak = 0

  const items = Array.from({ length: 20 }, (_, i) => i)

  await runTasks(items, 4, async () => {
    inFlight++
    peak = Math.max(peak, inFlight)
    await sleep(5)
    inFlight--
  }, 100)

  assertEquals(peak <= 4, true)
})

Deno.test('runTasks records a correctly ordered mix of success and failure', async () => {
  const items = [0, 1, 2, 3, 4]

  const outcomes = await runTasks(items, 3, async (item) => {
    if (item % 2 === 0) throw new Error(`fail-${item}`)
  }, 100)

  assertEquals(outcomes.length, 5)
  outcomes.forEach((outcome, index) => {
    assertEquals(outcome.index, index)
    assertEquals(outcome.item, items[index])
    assertEquals(outcome.success, items[index] % 2 !== 0)
  })
})

Deno.test('runTasks does not short-circuit like Promise.all on a rejection', async () => {
  const items = [0, 1, 2]
  let completed = 0

  const outcomes = await runTasks(items, 3, async (item) => {
    if (item === 0) throw new Error('boom')
    completed++
  }, 100)

  assertEquals(completed, 2)
  assertEquals(outcomes.filter((o) => o.success).length, 2)
})

Deno.test('runTasks trips the circuit breaker after consecutive failures and skips the rest', async () => {
  const items = Array.from({ length: 10 }, (_, i) => i)
  let calls = 0

  const outcomes = await runTasks(items, 1, async () => {
    calls++
    throw new Error('always fails')
  }, 3)

  assertEquals(calls, 3)

  const failed = outcomes.filter((o) => !o.success && !o.skipped)
  const skipped = outcomes.filter((o) => o.skipped)

  assertEquals(failed.length, 3)
  assertEquals(skipped.length, 7)
})

Deno.test('a success resets the consecutive-failure counter', async () => {
  const items = Array.from({ length: 8 }, (_, i) => i)
  let calls = 0

  const outcomes = await runTasks(items, 1, async (item) => {
    calls++
    if (item % 2 === 0) throw new Error('fails on even items')
  }, 2)

  assertEquals(calls, items.length)
  assertEquals(outcomes.every((o) => !o.skipped), true)
})
