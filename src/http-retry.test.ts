import { assertEquals, assertRejects } from 'https://deno.land/std@0.205.0/assert/mod.ts'
import { fetchWithRetry, RetryConfig } from './http-retry.ts'

const fastRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1,
  maxDelayMs: 5,
}

function jsonResponse(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers })
}

function withFetch(impl: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return run().finally(() => {
    globalThis.fetch = original
  })
}

Deno.test('fetchWithRetry succeeds immediately on a 200', async () => {
  await withFetch(
    () => Promise.resolve(jsonResponse(200, { ok: true })),
    async () => {
      const data = await fetchWithRetry('https://example.com', {}, 'test', fastRetryConfig)
      assertEquals(data.responseJson, { ok: true })
    },
  )
})

Deno.test('fetchWithRetry retries a 429 then succeeds', async () => {
  let calls = 0

  await withFetch(
    () => {
      calls++
      if (calls === 1) return Promise.resolve(jsonResponse(429, { error: { status: 'RESOURCE_EXHAUSTED' } }))
      return Promise.resolve(jsonResponse(200, { ok: true }))
    },
    async () => {
      const data = await fetchWithRetry('https://example.com', {}, 'test', fastRetryConfig)
      assertEquals(data.responseJson, { ok: true })
      assertEquals(calls, 2)
    },
  )
})

Deno.test('fetchWithRetry retries a 403 rateLimitExceeded', async () => {
  let calls = 0

  await withFetch(
    () => {
      calls++
      if (calls === 1) {
        return Promise.resolve(
          jsonResponse(403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }),
        )
      }
      return Promise.resolve(jsonResponse(200, { ok: true }))
    },
    async () => {
      const data = await fetchWithRetry('https://example.com', {}, 'test', fastRetryConfig)
      assertEquals(data.responseJson, { ok: true })
      assertEquals(calls, 2)
    },
  )
})

Deno.test('fetchWithRetry does not retry a 400 and throws immediately', async () => {
  let calls = 0

  await withFetch(
    () => {
      calls++
      return Promise.resolve(jsonResponse(400, { error: { message: 'Bad request' } }))
    },
    async () => {
      await assertRejects(() =>
        fetchWithRetry('https://example.com', {}, 'test', fastRetryConfig)
      )
      assertEquals(calls, 1)
    },
  )
})

Deno.test('fetchWithRetry honors a Retry-After header', async () => {
  let calls = 0
  const delays: (number | undefined)[] = []
  const start = performance.now()

  await withFetch(
    () => {
      calls++
      if (calls === 1) {
        return Promise.resolve(jsonResponse(429, { error: {} }, { 'retry-after': '0.01' }))
      }
      delays.push(performance.now() - start)
      return Promise.resolve(jsonResponse(200, { ok: true }))
    },
    async () => {
      await fetchWithRetry('https://example.com', {}, 'test', fastRetryConfig)
      assertEquals(calls, 2)
    },
  )
})

Deno.test('fetchWithRetry throws the last error once retries are exhausted', async () => {
  let calls = 0

  await withFetch(
    () => {
      calls++
      return Promise.resolve(jsonResponse(503, { error: { status: 'UNAVAILABLE' } }))
    },
    async () => {
      await assertRejects(() =>
        fetchWithRetry('https://example.com', {}, 'test', fastRetryConfig)
      )
      assertEquals(calls, fastRetryConfig.maxRetries + 1)
    },
  )
})
