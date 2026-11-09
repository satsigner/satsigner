import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import {
  cancelAccountSync,
  cancelAllAccountSyncs,
  hasCurrentSyncRun,
  isAccountSyncing,
  runExclusiveOnCoreNode,
  settleCancelledSyncStatuses,
  trackAccountSyncWork,
  waitForAccountSyncWork,
  walletSyncQueue
} from '@/utils/accountSyncRuns'

type StoredAccount = Pick<Account, 'id' | 'lastSyncedAt' | 'syncStatus'>

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => {
  const { create: createStore } =
    jest.requireActual<typeof import('zustand')>('zustand')
  return {
    useAccountsStore: createStore<{
      accounts: StoredAccount[]
      setSyncStatus: (id: string, syncStatus: Account['syncStatus']) => void
    }>((set) => ({
      accounts: [],
      setSyncStatus: (id, syncStatus) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === id ? { ...account, syncStatus } : account
          )
        }))
    }))
  }
})

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

  it('keeps a cancelled running job syncing until its tracked native work settles', async () => {
    const { gate, work } = pendingSync()
    const result = walletSyncQueue.enqueue(
      'acc',
      () => trackAccountSyncWork('acc', work),
      { timeoutMs: SYNC_TIMEOUT_MS }
    )

    cancelAccountSync('acc')

    await expect(result).resolves.toBeNull()
    expect(hasCurrentSyncRun('acc')).toBe(false)
    expect(isAccountSyncing('acc')).toBe(true)

    gate.open?.()
    await expect(waitForAccountSyncWork('acc', WAIT_TIMEOUT_MS)).resolves.toBe(
      true
    )
    expect(isAccountSyncing('acc')).toBe(false)
  })

  it('runs Core syncs to the same node one at a time', async () => {
    const first = pendingSync()
    const secondWork = jest.fn(() => Promise.resolve('second'))

    const firstRun = runExclusiveOnCoreNode(
      'http://node:8332',
      () => first.work
    )
    const secondRun = runExclusiveOnCoreNode('http://node:8332', secondWork)
    const otherNode = runExclusiveOnCoreNode('http://other:8332', () =>
      Promise.resolve('other')
    )

    await expect(otherNode).resolves.toBe('other')
    expect(secondWork).not.toHaveBeenCalled()

    first.gate.open?.()
    await firstRun
    await expect(secondRun).resolves.toBe('second')
  })

  it('settles statuses left by cancelled syncs but not by running ones', () => {
    const { work } = pendingSync()
    void walletSyncQueue.enqueue('running', () => work, {
      timeoutMs: SYNC_TIMEOUT_MS
    })
    useAccountsStore.setState({
      accounts: [
        {
          id: 'synced-before',
          lastSyncedAt: new Date(0),
          syncStatus: 'syncing'
        },
        { id: 'never-synced', syncStatus: 'queued' },
        { id: 'stalled', syncStatus: 'timeout' },
        { id: 'running', syncStatus: 'syncing' }
      ]
    })

    settleCancelledSyncStatuses()

    expect(
      useAccountsStore
        .getState()
        .accounts.map(({ id, syncStatus }) => [id, syncStatus])
    ).toStrictEqual([
      ['synced-before', 'synced'],
      ['never-synced', 'unsynced'],
      ['stalled', 'timeout'],
      ['running', 'syncing']
    ])
  })
})
