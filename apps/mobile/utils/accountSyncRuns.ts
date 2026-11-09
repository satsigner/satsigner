import { SYNC_CONCURRENCY } from '@/constants/sync'
import { createSyncQueue } from '@/services/syncQueue'
import { type Account } from '@/types/models/Account'
import { withTimeout } from '@/utils/time'

// Every wallet sync in the app goes through this queue, which runs a few at a
// time, lets priority syncs skip the line and aborts syncs that stall. It
// also owns cancellation: a cancelled job frees its slot and drops its result.
const walletSyncQueue = createSyncQueue<Account | null>(SYNC_CONCURRENCY)
// The native wallet is not safe for two syncs at once, and a cancelled or
// stalled job's native call can keep running after its slot is freed, so that
// work is tracked until it settles and the next sync of the account waits.
const inFlightWork = new Map<string, Promise<unknown>>()
// The latest queued or running Bitcoin Core sync per node URL.
const coreNodeWork = new Map<string, Promise<unknown>>()

/** Drops a queued sync of the account or makes a running one drop its result. */
function cancelAccountSync(accountId: string) {
  walletSyncQueue.cancel(accountId)
}

/** Cancels every queued and running sync, e.g. when the app locks. */
function cancelAllAccountSyncs() {
  walletSyncQueue.cancelAll()
}

/** True while the account is queued or syncing, or cancelled work still runs. */
function isAccountSyncing(accountId: string): boolean {
  return walletSyncQueue.isActive(accountId) || inFlightWork.has(accountId)
}

/** True while the account is queued or syncing, ignoring cancelled work. */
function hasCurrentSyncRun(accountId: string): boolean {
  return walletSyncQueue.isActive(accountId)
}

/**
 * Resolves true once the work of an earlier run of the account has settled,
 * or false if it is still going after `timeoutMs`.
 */
async function waitForAccountSyncWork(
  accountId: string,
  timeoutMs: number
): Promise<boolean> {
  const previous = inFlightWork.get(accountId)
  if (!previous) {
    return true
  }
  try {
    return await withTimeout(settles(previous), timeoutMs)
  } catch {
    return false
  }
}

async function settles(work: Promise<unknown>): Promise<true> {
  try {
    await work
  } catch {
    // The earlier run reports its own failure.
  }
  return true
}

async function trackAccountSyncWork<T>(
  accountId: string,
  work: Promise<T>
): Promise<T> {
  inFlightWork.set(accountId, work)
  try {
    return await work
  } finally {
    if (inFlightWork.get(accountId) === work) {
      inFlightWork.delete(accountId)
    }
  }
}

async function afterSettled<T>(
  previous: Promise<unknown>,
  work: () => Promise<T>
): Promise<T> {
  await settles(previous)
  return work()
}

/** Runs `work` once every earlier Core sync to the same node has settled. */
async function runExclusiveOnCoreNode<T>(
  nodeUrl: string,
  work: () => Promise<T>
): Promise<T> {
  const run = afterSettled(coreNodeWork.get(nodeUrl) ?? Promise.resolve(), work)
  coreNodeWork.set(nodeUrl, run)
  try {
    return await run
  } finally {
    if (coreNodeWork.get(nodeUrl) === run) {
      coreNodeWork.delete(nodeUrl)
    }
  }
}

export {
  cancelAccountSync,
  cancelAllAccountSyncs,
  hasCurrentSyncRun,
  isAccountSyncing,
  runExclusiveOnCoreNode,
  trackAccountSyncWork,
  waitForAccountSyncWork,
  walletSyncQueue
}
