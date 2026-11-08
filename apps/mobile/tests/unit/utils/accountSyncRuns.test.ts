import {
  cancelAccountSync,
  cancelAllAccountSyncs,
  hasCurrentSyncRun,
  isAccountSyncing,
  isPrioritySyncActiveFor,
  isSyncRunCurrent,
  releaseSyncRun,
  startSyncRun,
  trackAccountSyncWork,
  waitForAccountSyncWork
} from '@/utils/accountSyncRuns'

describe('account sync runs', () => {
  beforeEach(() => {
    cancelAllAccountSyncs()
  })

  it('lets a newer run of the same account supersede the older one', () => {
    const older = startSyncRun('acc', false)
    const newer = startSyncRun('acc', true)

    expect(isSyncRunCurrent('acc', older)).toBe(false)
    expect(isSyncRunCurrent('acc', newer)).toBe(true)

    releaseSyncRun('acc', older)
    expect(hasCurrentSyncRun('acc')).toBe(true)
    releaseSyncRun('acc', newer)
    expect(hasCurrentSyncRun('acc')).toBe(false)
  })

  it('does not let a cancel before a sync starts block the next sync', () => {
    cancelAccountSync('acc')

    const runId = startSyncRun('acc', true)

    expect(isSyncRunCurrent('acc', runId)).toBe(true)
  })

  it('holds background syncs of other accounts only while the priority run is active', () => {
    const runId = startSyncRun('priority', true)
    expect(isPrioritySyncActiveFor('other')).toBe(true)
    expect(isPrioritySyncActiveFor('priority')).toBe(false)

    releaseSyncRun('priority', runId)
    expect(isPrioritySyncActiveFor('other')).toBe(false)
  })

  it('keeps an older priority run from lifting a newer run hold', () => {
    const older = startSyncRun('acc', true)
    startSyncRun('acc', true)

    releaseSyncRun('acc', older)

    expect(isPrioritySyncActiveFor('other')).toBe(true)
  })

  it('reports a superseded run as syncing until its native work settles', async () => {
    const runId = startSyncRun('acc', false)
    const gate: { open?: () => void } = {}
    const work = new Promise<void>((resolve) => {
      gate.open = resolve
    })
    const tracked = trackAccountSyncWork('acc', work)

    cancelAccountSync('acc')
    expect(hasCurrentSyncRun('acc')).toBe(false)
    expect(isAccountSyncing('acc')).toBe(true)

    const waited = waitForAccountSyncWork('acc')
    gate.open?.()
    await waited
    await tracked
    releaseSyncRun('acc', runId)

    expect(isAccountSyncing('acc')).toBe(false)
  })

  it('waits through a failed earlier run without throwing', async () => {
    const failure = new Error('sync failed')
    const tracked = trackAccountSyncWork('acc', Promise.reject(failure))

    await expect(waitForAccountSyncWork('acc')).resolves.toBeUndefined()
    await expect(tracked).rejects.toBe(failure)
  })
})
