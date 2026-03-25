import { DEFAULT_RETRY_CONFIG } from '@/constants/nostr'

export type RetryConfig = {
  baseDelayMs: number
  jitterFactor: number
  maxDelayMs: number
  maxRetries: number
}

/**
 * Calculate retry delay with exponential backoff and jitter
 *
 * Formula: min(baseDelay * 2^attempt, maxDelay) * (1 + random * jitterFactor)
 *
 * @param attempt - Current retry attempt (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  attempt: number,
  config: Partial<RetryConfig> = {}
): number {
  const {
    baseDelayMs = DEFAULT_RETRY_CONFIG.baseDelayMs,
    maxDelayMs = DEFAULT_RETRY_CONFIG.maxDelayMs,
    jitterFactor = DEFAULT_RETRY_CONFIG.jitterFactor
  } = config

  const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs)
  const jitter = cappedDelay * jitterFactor * Math.random()

  return cappedDelay + jitter
}

export type RetryManagerHandle = {
  cancel: (key: string) => void
  getAttemptCount: (key: string) => number
  isMaxRetriesReached: (key: string) => boolean
  isPending: (key: string) => boolean
  reset: (key: string) => void
  resetAll: () => void
  scheduleRetry: (
    key: string,
    callback: () => void
  ) => { scheduled: boolean; delay: number }
}

export function createRetryManager(
  config: Partial<RetryConfig> = {}
): RetryManagerHandle {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const attempts = new Map<string, number>()
  const timers = new Map<string, NodeJS.Timeout>()

  function cancel(key: string): void {
    const timer = timers.get(key)
    if (timer) {
      clearTimeout(timer)
      timers.delete(key)
    }
  }

  function scheduleRetry(
    key: string,
    callback: () => void
  ): { scheduled: boolean; delay: number } {
    const attempt = attempts.get(key) || 0

    if (attempt >= cfg.maxRetries) {
      return { scheduled: false, delay: 0 }
    }

    const delay = calculateRetryDelay(attempt, cfg)
    cancel(key)

    const timer = setTimeout(() => {
      attempts.set(key, attempt + 1)
      timers.delete(key)
      callback()
    }, delay)

    timers.set(key, timer)
    return { scheduled: true, delay }
  }

  function reset(key: string): void {
    cancel(key)
    attempts.delete(key)
  }

  function resetAll(): void {
    for (const key of timers.keys()) {
      cancel(key)
    }
    attempts.clear()
  }

  function getAttemptCount(key: string): number {
    return attempts.get(key) || 0
  }

  function isMaxRetriesReached(key: string): boolean {
    return getAttemptCount(key) >= cfg.maxRetries
  }

  function isPending(key: string): boolean {
    return timers.has(key)
  }

  return {
    cancel,
    getAttemptCount,
    isMaxRetriesReached,
    isPending,
    reset,
    resetAll,
    scheduleRetry
  }
}
