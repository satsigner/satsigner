import { SyncTimeoutError, createSyncQueue } from '@/services/syncQueue'

const TIMEOUT_MS = 1000

type Deferred = {
  promise: Promise<string>
  resolve: (value: string) => void
  reject: (reason: unknown) => void
  signal?: AbortSignal
}

function deferredTask() {
  const deferred: Deferred = {
    promise: Promise.resolve(''),
    reject: () => null,
    resolve: () => null
  }
  deferred.promise = new Promise<string>((resolve, reject) => {
    deferred.resolve = resolve
    deferred.reject = reject
  })
  const task = jest.fn((signal: AbortSignal) => {
    deferred.signal = signal
    return deferred.promise
  })
  return { deferred, task }
}

function expectStarted(task: jest.Mock) {
  expect(task).toHaveBeenCalledWith(
    expect.any(AbortSignal),
    expect.any(Function)
  )
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('createSyncQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('runs at most `concurrency` background syncs at once', async () => {
    const queue = createSyncQueue<string>(2)
    const a = deferredTask()
    const b = deferredTask()
    const c = deferredTask()
    const onQueued = jest.fn()

    const resultA = queue.enqueue('a', a.task, { timeoutMs: TIMEOUT_MS })
    queue.enqueue('b', b.task, { timeoutMs: TIMEOUT_MS })
    queue.enqueue('c', c.task, { onQueued, timeoutMs: TIMEOUT_MS })

    expectStarted(a.task)
    expectStarted(b.task)
    expect(c.task).not.toHaveBeenCalled()
    expect(onQueued).toHaveBeenCalledTimes(1)

    a.deferred.resolve('done-a')
    await expect(resultA).resolves.toBe('done-a')
    expectStarted(c.task)
  })

  it('starts a priority sync even when every slot is busy', () => {
    const queue = createSyncQueue<string>(1)
    const background = deferredTask()
    const priority = deferredTask()

    queue.enqueue('a', background.task, { timeoutMs: TIMEOUT_MS })
    queue.enqueue('b', priority.task, { priority: true, timeoutMs: TIMEOUT_MS })

    expectStarted(priority.task)
  })

  it('promotes a queued account when it is requested at priority', () => {
    const queue = createSyncQueue<string>(1)
    const background = deferredTask()
    const queued = deferredTask()

    queue.enqueue('a', background.task, { timeoutMs: TIMEOUT_MS })
    queue.enqueue('b', queued.task, { timeoutMs: TIMEOUT_MS })
    expect(queued.task).not.toHaveBeenCalled()

    queue.enqueue('b', jest.fn(), { priority: true, timeoutMs: TIMEOUT_MS })
    expectStarted(queued.task)
  })

  it('shares the running job instead of syncing an account twice', async () => {
    const queue = createSyncQueue<string>(2)
    const first = deferredTask()
    const second = jest.fn()

    const resultFirst = queue.enqueue('a', first.task, {
      timeoutMs: TIMEOUT_MS
    })
    const resultSecond = queue.enqueue('a', second, { timeoutMs: TIMEOUT_MS })

    expect(second).not.toHaveBeenCalled()
    first.deferred.resolve('done')
    await expect(resultFirst).resolves.toBe('done')
    await expect(resultSecond).resolves.toBe('done')
  })

  it('aborts a stalled sync and frees its slot when time runs out', async () => {
    const queue = createSyncQueue<string>(1)
    const stalled = deferredTask()
    const next = deferredTask()

    const result = queue.enqueue('a', stalled.task, { timeoutMs: TIMEOUT_MS })
    queue.enqueue('b', next.task, { timeoutMs: TIMEOUT_MS })

    jest.advanceTimersByTime(TIMEOUT_MS)

    await expect(result).rejects.toBeInstanceOf(SyncTimeoutError)
    expect(stalled.deferred.signal?.aborted).toBe(true)
    expectStarted(next.task)
    expect(queue.isActive('a')).toBe(false)
  })

  it('ignores a late result from a sync that already timed out', async () => {
    const queue = createSyncQueue<string>(1)
    const stalled = deferredTask()

    const result = queue.enqueue('a', stalled.task, { timeoutMs: TIMEOUT_MS })
    jest.advanceTimersByTime(TIMEOUT_MS)
    await expect(result).rejects.toBeInstanceOf(SyncTimeoutError)

    const fresh = deferredTask()
    const freshResult = queue.enqueue('a', fresh.task, {
      timeoutMs: TIMEOUT_MS
    })
    stalled.deferred.resolve('stale')
    await flushPromises()
    expect(queue.isActive('a')).toBe(true)

    fresh.deferred.resolve('fresh')
    await expect(freshResult).resolves.toBe('fresh')
  })

  it('cancel drops a queued sync without running it', async () => {
    const queue = createSyncQueue<string>(1)
    const running = deferredTask()
    const queued = deferredTask()

    queue.enqueue('a', running.task, { timeoutMs: TIMEOUT_MS })
    const result = queue.enqueue('b', queued.task, { timeoutMs: TIMEOUT_MS })

    queue.cancel('b')
    await expect(result).resolves.toBeNull()

    running.deferred.resolve('done')
    await flushPromises()
    expect(queued.task).not.toHaveBeenCalled()
  })

  it('cancel aborts a running sync and frees its slot', async () => {
    const queue = createSyncQueue<string>(1)
    const running = deferredTask()
    const queued = deferredTask()

    const result = queue.enqueue('a', running.task, { timeoutMs: TIMEOUT_MS })
    queue.enqueue('b', queued.task, { timeoutMs: TIMEOUT_MS })

    queue.cancel('a')

    await expect(result).resolves.toBeNull()
    expect(running.deferred.signal?.aborted).toBe(true)
    expectStarted(queued.task)
  })

  it('passes a sync error to the caller', async () => {
    const queue = createSyncQueue<string>(1)
    const failing = deferredTask()

    const result = queue.enqueue('a', failing.task, { timeoutMs: TIMEOUT_MS })
    failing.deferred.reject(new Error('boom'))

    await expect(result).rejects.toThrow('boom')
    expect(queue.isActive('a')).toBe(false)
  })
})

describe('createSyncQueue progress', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('keeps a slow sync alive while it reports progress', async () => {
    const queue = createSyncQueue<string>(1)
    const progress: { report?: () => void } = {}
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve('done'), TIMEOUT_MS * 3)
    })

    const result = queue.enqueue(
      'a',
      (_signal, reportProgress) => {
        progress.report = reportProgress
        return slow
      },
      { timeoutMs: TIMEOUT_MS }
    )

    for (const _step of Array.from({ length: 5 })) {
      jest.advanceTimersByTime(TIMEOUT_MS * 0.6)
      progress.report?.()
    }

    await expect(result).resolves.toBe('done')
  })
})
