import {
  calculateRetryDelay,
  RetryManager,
  DEFAULT_RETRY_CONFIG
} from '@/services/nostr/RetryManager'

describe('calculateRetryDelay', () => {
  beforeEach(() => {
    // Mock Math.random to return consistent values for testing
    jest.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('uses exponential backoff', () => {
    const config = { baseDelayMs: 1000, maxDelayMs: 60000, jitterFactor: 0 }

    const delays = [0, 1, 2, 3, 4].map((attempt) =>
      calculateRetryDelay(attempt, config)
    )

    expect(delays[0]).toBe(1000) // 1000 * 2^0
    expect(delays[1]).toBe(2000) // 1000 * 2^1
    expect(delays[2]).toBe(4000) // 1000 * 2^2
    expect(delays[3]).toBe(8000) // 1000 * 2^3
    expect(delays[4]).toBe(16000) // 1000 * 2^4
  })

  it('caps at maxDelayMs', () => {
    const config = { baseDelayMs: 1000, maxDelayMs: 60000, jitterFactor: 0 }

    const delay = calculateRetryDelay(10, config)

    // 1000 * 2^10 = 1024000, but capped at 60000
    expect(delay).toBe(60000)
  })

  it('adds jitter to prevent thundering herd', () => {
    // With random = 0.5 and jitterFactor = 0.2:
    // jitter = 1000 * 0.2 * 0.5 = 100
    const config = { baseDelayMs: 1000, maxDelayMs: 60000, jitterFactor: 0.2 }

    const delay = calculateRetryDelay(0, config)

    expect(delay).toBe(1100) // 1000 + 100 jitter
  })

  it('uses default config values', () => {
    const delay = calculateRetryDelay(0)

    // With defaults: baseDelayMs=1000, jitterFactor=0.2, random=0.5
    // Expected: 1000 + (1000 * 0.2 * 0.5) = 1100
    expect(delay).toBe(1100)
  })

  it('varies jitter based on random value', () => {
    const config = { baseDelayMs: 1000, maxDelayMs: 60000, jitterFactor: 0.2 }

    // Test with different random values
    jest.spyOn(Math, 'random').mockReturnValue(0)
    const delayMin = calculateRetryDelay(0, config)
    expect(delayMin).toBe(1000) // No jitter when random = 0

    jest.spyOn(Math, 'random').mockReturnValue(1)
    const delayMax = calculateRetryDelay(0, config)
    expect(delayMax).toBe(1200) // Max jitter when random = 1
  })
})

describe('RetryManager', () => {
  let manager: RetryManager

  beforeEach(() => {
    jest.useFakeTimers()
    manager = new RetryManager({
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      maxRetries: 5,
      jitterFactor: 0
    })
  })

  afterEach(() => {
    manager.resetAll()
    jest.useRealTimers()
  })

  describe('scheduleRetry', () => {
    it('schedules retry and calls callback', () => {
      const callback = jest.fn()

      const result = manager.scheduleRetry('test-key', callback)

      expect(result.scheduled).toBe(true)
      expect(result.delay).toBe(1000)
      expect(callback).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('increments attempt count after callback', () => {
      const callback = jest.fn()

      manager.scheduleRetry('test-key', callback)
      expect(manager.getAttemptCount('test-key')).toBe(0)

      jest.advanceTimersByTime(1000)

      expect(manager.getAttemptCount('test-key')).toBe(1)
    })

    it('increases delay with each attempt', () => {
      const callback = jest.fn()

      // First attempt
      const result1 = manager.scheduleRetry('test-key', callback)
      expect(result1.delay).toBe(1000)
      jest.advanceTimersByTime(1000)

      // Second attempt
      const result2 = manager.scheduleRetry('test-key', callback)
      expect(result2.delay).toBe(2000)
      jest.advanceTimersByTime(2000)

      // Third attempt
      const result3 = manager.scheduleRetry('test-key', callback)
      expect(result3.delay).toBe(4000)
    })

    it('returns not scheduled when max retries reached', () => {
      const callback = jest.fn()

      // Exhaust all retries
      for (let i = 0; i < 5; i++) {
        manager.scheduleRetry('test-key', callback)
        jest.advanceTimersByTime(100000) // Advance past any delay
      }

      const result = manager.scheduleRetry('test-key', callback)

      expect(result.scheduled).toBe(false)
      expect(result.delay).toBe(0)
    })

    it('cancels previous timer when scheduling again', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      manager.scheduleRetry('test-key', callback1)
      manager.scheduleRetry('test-key', callback2)

      jest.advanceTimersByTime(1000)

      // Only the second callback should be called
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalledTimes(1)
    })
  })

  describe('cancel', () => {
    it('cancels pending retry', () => {
      const callback = jest.fn()

      manager.scheduleRetry('test-key', callback)
      manager.cancel('test-key')

      jest.advanceTimersByTime(100000)

      expect(callback).not.toHaveBeenCalled()
    })

    it('does nothing for non-existent key', () => {
      expect(() => manager.cancel('non-existent')).not.toThrow()
    })
  })

  describe('reset', () => {
    it('resets attempt count and cancels timer', () => {
      const callback = jest.fn()

      manager.scheduleRetry('test-key', callback)
      jest.advanceTimersByTime(1000)
      expect(manager.getAttemptCount('test-key')).toBe(1)

      manager.reset('test-key')

      expect(manager.getAttemptCount('test-key')).toBe(0)
      expect(manager.isPending('test-key')).toBe(false)
    })
  })

  describe('resetAll', () => {
    it('resets all keys', () => {
      const callback = jest.fn()

      manager.scheduleRetry('key1', callback)
      manager.scheduleRetry('key2', callback)
      jest.advanceTimersByTime(1000)

      manager.resetAll()

      expect(manager.getAttemptCount('key1')).toBe(0)
      expect(manager.getAttemptCount('key2')).toBe(0)
    })
  })

  describe('getAttemptCount', () => {
    it('returns 0 for unknown key', () => {
      expect(manager.getAttemptCount('unknown')).toBe(0)
    })
  })

  describe('isMaxRetriesReached', () => {
    it('returns false initially', () => {
      expect(manager.isMaxRetriesReached('test-key')).toBe(false)
    })

    it('returns true after max retries', () => {
      const callback = jest.fn()

      for (let i = 0; i < 5; i++) {
        manager.scheduleRetry('test-key', callback)
        jest.advanceTimersByTime(100000)
      }

      expect(manager.isMaxRetriesReached('test-key')).toBe(true)
    })
  })

  describe('isPending', () => {
    it('returns false when no retry scheduled', () => {
      expect(manager.isPending('test-key')).toBe(false)
    })

    it('returns true when retry is scheduled', () => {
      manager.scheduleRetry('test-key', jest.fn())
      expect(manager.isPending('test-key')).toBe(true)
    })

    it('returns false after retry completes', () => {
      manager.scheduleRetry('test-key', jest.fn())
      jest.advanceTimersByTime(1000)
      expect(manager.isPending('test-key')).toBe(false)
    })
  })
})

describe('DEFAULT_RETRY_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000)
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(60000)
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(5)
    expect(DEFAULT_RETRY_CONFIG.jitterFactor).toBe(0.2)
  })
})
