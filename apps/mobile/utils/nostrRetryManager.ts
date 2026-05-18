import { NOSTR_DEFAULT_RETRY_CONFIG } from '@/constants/nostr'
import { NostrRetryConfig, NostrRetryManagerHandle } from '@/types/models/Nostr'

export function calculateRetryDelay(
  attempt: number,
  config: Partial<NostrRetryConfig> = {}
): number {
  const {
    baseDelayMs = NOSTR_DEFAULT_RETRY_CONFIG.baseDelayMs,
    maxDelayMs = NOSTR_DEFAULT_RETRY_CONFIG.maxDelayMs,
    jitterFactor = NOSTR_DEFAULT_RETRY_CONFIG.jitterFactor
  } = config

  const exponentialDelay = baseDelayMs * 2 ** attempt
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs)
  const jitter = cappedDelay * jitterFactor * Math.random()

  return cappedDelay + jitter
}

export function createRetryManager(
  config: Partial<NostrRetryConfig> = {}
): NostrRetryManagerHandle {
  const cfg: NostrRetryConfig = { ...NOSTR_DEFAULT_RETRY_CONFIG, ...config }
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
    onSchedule: () => void
  ): { scheduled: boolean; delay: number } {
    const attempt = attempts.get(key) || 0

    if (attempt >= cfg.maxRetries) {
      return { delay: 0, scheduled: false }
    }

    const delay = calculateRetryDelay(attempt, cfg)
    cancel(key)

    const timer = setTimeout(() => {
      attempts.set(key, attempt + 1)
      timers.delete(key)
      onSchedule()
    }, delay)

    timers.set(key, timer)
    return { delay, scheduled: true }
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
