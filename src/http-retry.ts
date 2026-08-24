import appSettings from '../config/config.ts'

interface GoogleApiError {
  code?: number
  message?: string
  status?: string
  errors?: { reason?: string }[]
}

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: appSettings.maxRetries,
  baseDelayMs: appSettings.retryBaseDelayMs,
  maxDelayMs: appSettings.retryMaxDelayMs,
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])
const RETRYABLE_403_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'quotaExceeded',
])

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  context: string,
  retryConfig: RetryConfig = defaultRetryConfig,
): Promise<{ status: string; responseJson: any }> {
  const { maxRetries, baseDelayMs, maxDelayMs } = retryConfig

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response

    try {
      response = await fetch(url, init)
    } catch (e) {
      if (attempt === maxRetries) throw e
      await waitBeforeRetry(
        attempt,
        undefined,
        context,
        `network error - ${e}`,
        retryConfig,
      )
      continue
    }

    if (response.ok) {
      const status = `${response.status}: ${response.statusText}`
      const responseJson = await response.json()
      return { status, responseJson }
    }

    const responseJson = await response.json()
    const error: GoogleApiError | string = responseJson.error

    if (!isRetryable(response.status, error) || attempt === maxRetries) {
      throw error
    }

    const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
    await waitBeforeRetry(
      attempt,
      retryAfterMs,
      context,
      describeError(response.status, error),
      retryConfig,
    )
  }

  throw new Error(`fetchWithRetry() exhausted retries for ${context}`)
}

function isRetryable(status: number, error: GoogleApiError | string): boolean {
  if (RETRYABLE_STATUS.has(status)) return true

  if (status === 403 && typeof error === 'object') {
    const reasons = (error.errors ?? []).map((e) => e.reason)
    return reasons.some((reason) => reason && RETRYABLE_403_REASONS.has(reason))
  }

  return false
}

function describeError(status: number, error: GoogleApiError | string): string {
  if (typeof error === 'string') return `${status} ${error}`
  return `${status} ${error?.status ?? error?.message ?? ''}`
}

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined

  const asSeconds = Number(headerValue)
  if (!Number.isNaN(asSeconds)) return asSeconds * 1000

  const asDate = Date.parse(headerValue)
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now())

  return undefined
}

async function waitBeforeRetry(
  attempt: number,
  retryAfterMs: number | undefined,
  context: string,
  errorLabel: string,
  retryConfig: RetryConfig,
) {
  const exponential = Math.min(
    retryConfig.maxDelayMs,
    retryConfig.baseDelayMs * 2 ** attempt,
  )
  const delay = retryAfterMs ?? exponential * (0.5 + Math.random() * 0.5)

  console.log(
    `%c[ Retry ${
      attempt + 1
    }/${retryConfig.maxRetries} ${context} - ${errorLabel} - waiting ${
      Math.round(delay)
    }ms ]`,
    'color:orange',
  )

  await sleep(delay)
}

function sleep(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay))
}
