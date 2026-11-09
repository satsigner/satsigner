import { withTimeout } from '@/utils/time'

// One current run per account, shared across all sync hook instances. A newer
// run of the same account, or a cancel, replaces or removes the entry; the
// superseded run then drops its result at the next checkpoint instead of
// writing it over newer data.
const currentRuns = new Map<string, number>()
// The native wallet is not safe for two syncs at once, so the work of a
// superseded run is tracked until it settles and the next run waits for it.
const inFlightWork = new Map<string, Promise<unknown>>()
// While a priority run is active, background runs of other accounts yield so
// it gets the whole connection (RPC backends especially).
const syncRunState: {
  lastRunId: number
  prioritySync: { accountId: string; runId: number } | undefined
} = { lastRunId: 0, prioritySync: undefined }

/** Makes the account's running sync drop its result at the next checkpoint. */
function cancelAccountSync(accountId: string) {
  currentRuns.delete(accountId)
}

/** Cancels every running sync so a priority run can take over. */
function cancelAllAccountSyncs() {
  currentRuns.clear()
}

/** True while a run owns the account or a superseded run is still working. */
function isAccountSyncing(accountId: string): boolean {
  return currentRuns.has(accountId) || inFlightWork.has(accountId)
}

/** True while a run owns the account, ignoring superseded work. */
function hasCurrentSyncRun(accountId: string): boolean {
  return currentRuns.has(accountId)
}

function isPrioritySyncActiveFor(accountId: string): boolean {
  const { prioritySync } = syncRunState
  return prioritySync !== undefined && prioritySync.accountId !== accountId
}

function startSyncRun(accountId: string, isPriority: boolean): number {
  syncRunState.lastRunId += 1
  const runId = syncRunState.lastRunId
  currentRuns.set(accountId, runId)
  if (isPriority) {
    syncRunState.prioritySync = { accountId, runId }
  }
  return runId
}

function isSyncRunCurrent(accountId: string, runId: number): boolean {
  return currentRuns.get(accountId) === runId
}

function releaseSyncRun(accountId: string, runId: number) {
  if (isSyncRunCurrent(accountId, runId)) {
    currentRuns.delete(accountId)
  }
  if (syncRunState.prioritySync?.runId === runId) {
    syncRunState.prioritySync = undefined
  }
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

export {
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
}
