import { withTimeout } from '@/utils/time'

const TIMEOUT_MS = 1000

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('resolves with the value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve(7), TIMEOUT_MS)).resolves.toBe(7)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('passes the rejection through when the promise fails in time', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('boom')), TIMEOUT_MS)
    ).rejects.toThrow('boom')
    expect(jest.getTimerCount()).toBe(0)
  })

  it('rejects with the given message when the promise is too slow', async () => {
    const pending = withTimeout(new Promise(() => {}), TIMEOUT_MS, 'too slow')
    jest.advanceTimersByTime(TIMEOUT_MS)

    await expect(pending).rejects.toThrow('too slow')
  })

  it('falls back to a generic message', async () => {
    const pending = withTimeout(new Promise(() => {}), TIMEOUT_MS)
    jest.advanceTimersByTime(TIMEOUT_MS)

    await expect(pending).rejects.toThrow('Operation timed out')
  })
})
