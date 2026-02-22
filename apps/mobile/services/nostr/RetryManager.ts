/**
 * Configuration for exponential backoff retry logic
 */
export interface RetryConfig {
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs: number
  /** Maximum delay in milliseconds (default: 60000) */
  maxDelayMs: number
  /** Maximum number of retry attempts (default: 5) */
  maxRetries: number
  /** Jitter factor to prevent thundering herd (default: 0.2 = 20%) */
  jitterFactor: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  maxRetries: 5,
  jitterFactor: 0.2
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

  // Calculate exponential delay: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt)

  // Cap at maxDelayMs
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs)

  // Add random jitter to prevent thundering herd
  const jitter = cappedDelay * jitterFactor * Math.random()

  return cappedDelay + jitter
}

/**
 * Retry manager class for managing retry state
 */
export class RetryManager {
  private attempts: Map<string, number> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config }
  }

  /**
   * Schedule a retry for the given key
   */
  scheduleRetry(
    key: string,
    callback: () => void
  ): { scheduled: boolean; delay: number } {
    const attempt = this.attempts.get(key) || 0

    if (attempt >= this.config.maxRetries) {
      return { scheduled: false, delay: 0 }
    }

    const delay = calculateRetryDelay(attempt, this.config)

    this.cancel(key)

    const timer = setTimeout(() => {
      this.attempts.set(key, attempt + 1)
      this.timers.delete(key)
      callback()
    }, delay)

    this.timers.set(key, timer)

    return { scheduled: true, delay }
  }

  /**
   * Cancel pending retry for the given key
   */
  cancel(key: string): void {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
  }

  /**
   * Reset retry state for the given key
   */
  reset(key: string): void {
    this.cancel(key)
    this.attempts.delete(key)
  }

  /**
   * Reset all retry state
   */
  resetAll(): void {
    for (const key of this.timers.keys()) {
      this.cancel(key)
    }
    this.attempts.clear()
  }

  /**
   * Get current attempt count for the given key
   */
  getAttemptCount(key: string): number {
    return this.attempts.get(key) || 0
  }

  /**
   * Check if max retries has been reached for the given key
   */
  isMaxRetriesReached(key: string): boolean {
    return this.getAttemptCount(key) >= this.config.maxRetries
  }

  /**
   * Check if a retry is pending for the given key
   */
  isPending(key: string): boolean {
    return this.timers.has(key)
  }
}
