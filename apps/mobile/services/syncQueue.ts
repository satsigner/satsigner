/** Rejection reason when a sync makes no progress for too long. */
export class SyncTimeoutError extends Error {
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`Sync stalled for ${Math.round(timeoutMs / 1000)} s`)
    this.name = 'SyncTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

type EnqueueOptions = {
  onQueued?: () => void
  /** Starts right away, even when every background slot is busy. */
  priority?: boolean
  /** Aborts the sync after this long without a call to `reportProgress`. */
  timeoutMs: number
}

export type SyncTaskControls = {
  /** Network work is done; later steps (fiat prices) can't stall the sync. */
  finishScan: () => void
  reportProgress: () => void
  signal: AbortSignal
}

type SyncTask<T> = (controls: SyncTaskControls) => Promise<T>

type Outcome<T> = { value: T | null } | { error: unknown }

type Job<T> = {
  accountId: string
  controller: AbortController
  isPriority: boolean
  onQueued?: () => void
  promise: Promise<T | null>
  settle: (outcome: Outcome<T>) => void
  state: 'waiting' | 'running'
  task: SyncTask<T>
  timeoutMs: number
}

/**
 * One queue for every account sync in the app. Background syncs share a fixed
 * number of slots so one long history over Tor no longer holds up every
 * account behind it. A sync that stops making progress is aborted and its
 * slot freed, even if the native call never returns; a slow sync that keeps
 * reporting progress is left alone. Priority syncs (the user is looking at
 * the account) skip the line.
 */
export function createSyncQueue<T>(concurrency: number) {
  const jobs = new Map<string, Job<T>>()
  const waiting: Job<T>[] = []

  function runningBackgroundCount(): number {
    return [...jobs.values()].filter(
      (job) => job.state === 'running' && !job.isPriority
    ).length
  }

  function pump() {
    while (waiting.length > 0 && runningBackgroundCount() < concurrency) {
      const next = waiting.shift()
      if (next) {
        start(next)
      }
    }
  }

  function start(job: Job<T>) {
    job.state = 'running'
    const { signal } = job.controller
    const timer = { id: setTimeout(onStalled, job.timeoutMs) }

    function onStalled() {
      const error = new SyncTimeoutError(job.timeoutMs)
      job.controller.abort(error)
      job.settle({ error })
    }

    const scan = { finished: false }

    function reportProgress() {
      if (signal.aborted || scan.finished) {
        return
      }
      clearTimeout(timer.id)
      timer.id = setTimeout(onStalled, job.timeoutMs)
    }

    function finishScan() {
      scan.finished = true
      clearTimeout(timer.id)
    }

    signal.addEventListener('abort', () => clearTimeout(timer.id))

    void runTask(job, { finishScan, reportProgress, signal })
  }

  async function runTask(job: Job<T>, controls: SyncTaskControls) {
    try {
      job.settle({ value: await job.task(controls) })
    } catch (error) {
      job.settle({ error })
    }
  }

  function createJob(
    accountId: string,
    task: SyncTask<T>,
    options: EnqueueOptions
  ): Job<T> {
    const controller = new AbortController()
    const handlers: {
      reject: (reason: unknown) => void
      resolve: (value: T | null) => void
    } = { reject: () => null, resolve: () => null }
    const promise = new Promise<T | null>((resolve, reject) => {
      handlers.resolve = resolve
      handlers.reject = reject
    })
    const job: Job<T> = {
      accountId,
      controller,
      isPriority: options.priority === true,
      onQueued: options.onQueued,
      promise,
      settle: (outcome) => {
        if (jobs.get(accountId) !== job) {
          return
        }
        jobs.delete(accountId)
        controller.abort()
        if ('error' in outcome) {
          handlers.reject(outcome.error)
        } else {
          handlers.resolve(outcome.value)
        }
        pump()
      },
      state: 'waiting',
      task,
      timeoutMs: options.timeoutMs
    }
    return job
  }

  function removeWaiting(job: Job<T>) {
    const index = waiting.indexOf(job)
    if (index !== -1) {
      waiting.splice(index, 1)
    }
  }

  /**
   * Adds a sync for an account. An account that is already queued or syncing
   * is not synced twice; the caller shares the existing job's result.
   * Resolves to null when the job is cancelled.
   */
  function enqueue(
    accountId: string,
    task: SyncTask<T>,
    options: EnqueueOptions
  ): Promise<T | null> {
    const existing = jobs.get(accountId)
    if (existing) {
      if (options.priority && existing.state === 'waiting') {
        existing.isPriority = true
        removeWaiting(existing)
        start(existing)
      }
      return existing.promise
    }

    const job = createJob(accountId, task, options)
    jobs.set(accountId, job)

    if (job.isPriority || runningBackgroundCount() < concurrency) {
      start(job)
      return job.promise
    }

    waiting.push(job)
    // A failing status write must not strand the job outside the queue.
    try {
      job.onQueued?.()
    } catch {
      // status is cosmetic; the job is already waiting for a slot
    }
    return job.promise
  }

  /** Drops a queued sync or aborts a running one, freeing its slot. */
  function cancel(accountId: string) {
    const job = jobs.get(accountId)
    if (!job) {
      return
    }
    removeWaiting(job)
    job.settle({ value: null })
  }

  function isActive(accountId: string): boolean {
    return jobs.has(accountId)
  }

  return { cancel, enqueue, isActive }
}

export type SyncQueue<T> = ReturnType<typeof createSyncQueue<T>>
