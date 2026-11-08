// One current run per account, shared across all sync hook instances. A newer
// run of the same account, or a cancel, replaces or removes the entry; the
// superseded run then drops its result at the next checkpoint instead of
// writing it over newer data.
const currentRuns = new Map<string, number>()
// The native wallet is not safe for two syncs at once, so the work of a
// superseded run is tracked until it settles and the next run waits for it.
const inFlightWork = new Map<string, Promise<unknown>>()
let lastSyncRunId = 0
// While a priority run is active, background runs of other accounts yield so
// it gets the whole connection (RPC backends especially).
let prioritySync: { accountId: string; runId: number } | undefined

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
  return prioritySync !== undefined && prioritySync.accountId !== accountId
}

function startSyncRun(accountId: string, isPriority: boolean): number {
  lastSyncRunId += 1
  currentRuns.set(accountId, lastSyncRunId)
  if (isPriority) {
    prioritySync = { accountId, runId: lastSyncRunId }
  }
  return lastSyncRunId
}

function isSyncRunCurrent(accountId: string, runId: number): boolean {
  return currentRuns.get(accountId) === runId
}

function releaseSyncRun(accountId: string, runId: number) {
  if (isSyncRunCurrent(accountId, runId)) {
    currentRuns.delete(accountId)
  }
  if (prioritySync?.runId === runId) {
    prioritySync = undefined
  }
}

/** Resolves once the work of an earlier run of the account has settled. */
async function waitForAccountSyncWork(accountId: string): Promise<void> {
  const previous = inFlightWork.get(accountId)
  if (!previous) {
    return
  }
  try {
    await previous
  } catch {
    // The earlier run reports its own failure.
  }
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
