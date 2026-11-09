import {
  cancelAccountSync,
  cancelAllAccountSyncs,
  hasCurrentSyncRun,
  isAccountSyncing,
  trackAccountSyncWork,
  waitForAccountSyncWork,
  walletSyncQueue
} from '@/utils/accountSyncRuns'

const WAIT_TIMEOUT_MS = 1000
const SYNC_TIMEOUT_MS = 60_000

function pendingSync() {
  const gate: { open?: () => void } = {}
  const work = new Promise<null>((resolve) => {
    gate.open = () => resolve(null)
  })
  return { gate, work }
}

describe('account sync runs', () => {
  beforeEach(() => {
    cancelAllAccountSyncs()
  })

  it('reports an account as syncing while its queue job is active', () => {
    const { work } = pendingSync()
    void walletSyncQueue.enqueue('acc', () => work, {
      timeoutMs: SYNC_TIMEOUT_MS
    })

    expect(hasCurrentSyncRun('acc')).toBe(true)
    expect(isAccountSyncing('acc')).toBe(true)

    cancelAccountSync('acc')
    expect(hasCurrentSyncRun('acc')).toBe(false)
  })

  it('cancels every job when the app locks', async () => {
    const first = pendingSync()
    const second = pendingSync()
    const results = [
      walletSyncQueue.enqueue('a', () => first.work, {
        timeoutMs: SYNC_TIMEOUT_MS
      }),
      walletSyncQueue.enqueue('b', () => second.work, {
        timeoutMs: SYNC_TIMEOUT_MS
      })
    ]

    cancelAllAccountSyncs()

    await expect(Promise.all(results)).resolves.toStrictEqual([null, null])
    expect(hasCurrentSyncRun('a')).toBe(false)
    expect(hasCurrentSyncRun('b')).toBe(false)
  })

  it('reports a cancelled sync as syncing until its native work settles', async () => {
    const { gate, work } = pendingSync()
    const tracked = trackAccountSyncWork('acc', work)

    cancelAccountSync('acc')
    expect(hasCurrentSyncRun('acc')).toBe(false)
    expect(isAccountSyncing('acc')).toBe(true)

    const waited = waitForAccountSyncWork('acc', WAIT_TIMEOUT_MS)
    gate.open?.()
    await expect(waited).resolves.toBe(true)
    await tracked

    expect(isAccountSyncing('acc')).toBe(false)
  })

  it('waits through a failed earlier run without throwing', async () => {
    const failure = new Error('sync failed')
    const tracked = trackAccountSyncWork('acc', Promise.reject(failure))

    await expect(waitForAccountSyncWork('acc', WAIT_TIMEOUT_MS)).resolves.toBe(
      true
    )
    await expect(tracked).rejects.toBe(failure)
  })

  it('gives up waiting on an earlier run that never settles', async () => {
    jest.useFakeTimers()
    const stuck = new Promise<never>(jest.fn())
    void trackAccountSyncWork('stuck-acc', stuck)

    const waited = waitForAccountSyncWork('stuck-acc', WAIT_TIMEOUT_MS)
    jest.advanceTimersByTime(WAIT_TIMEOUT_MS)

    await expect(waited).resolves.toBe(false)
    jest.useRealTimers()
  })
})
