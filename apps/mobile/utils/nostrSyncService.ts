import { EventEmitter } from 'events'

import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_DEFAULT_RETRY_CONFIG,
  NOSTR_EOSE_TIMEOUT_MS,
  NOSTR_EVENT_FUTURE_TOLERANCE_SEC,
  NOSTR_PROTOCOL_SUBSCRIPTION_LIMIT,
  NOSTR_PROTOCOL_SUBSCRIPTION_LIMIT_FULL_SCAN
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { getNewestProcessedCreatedAt } from '@/db/nostrProcessedEvents'
import {
  type NostrBatchResult,
  processNostrEventBatch
} from '@/hooks/useNostrMessageProcessor'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import type {
  NostrErrorCode,
  NostrMessage,
  NostrSyncStatus,
  NostrSyncStatusEvent
} from '@/types/models/Nostr'
import { NostrRelayTimeoutError } from '@/utils/errors'
import { getNostrErrorCode } from '@/utils/nostrErrorMessage'
import { calculateRetryDelay } from '@/utils/nostrRetryManager'

type NostrSyncPurpose = 'dataExchange' | 'protocol'

type NostrMessageProcessor = (
  account: Account,
  messages: NostrMessage[]
) => Promise<NostrBatchResult | undefined>

type LoadingCallback = (loading: boolean) => void

type NostrCursorProgress = {
  newestProcessed: number
  oldestFailed: number | null
}

type LiveSubscription = {
  accountId: string
  api: NostrAPI
  purpose: NostrSyncPurpose
}

type ReadyAccount = Account & {
  nostr: Account['nostr'] & {
    commonNpub: string
    commonNsec: string
    deviceNpub: string
    deviceNsec: string
  }
}

type NostrSyncDiagnostics = {
  accountId: string
  activeSubscriptionKeys: string[]
  /** Seconds since each EOSE cursor, null when the purpose never synced. */
  eoseCursorAges: Record<NostrSyncPurpose, number | null>
  lastErrorCode: NostrErrorCode | null
  queueLength: number
  status: NostrSyncStatus
}

const SYNC_PURPOSES: NostrSyncPurpose[] = ['protocol', 'dataExchange']

// Raised above Node's default (10) since many concurrent account
// subscriptions each register their own listeners on this shared emitter.
const NOSTR_SYNC_EMITTER_MAX_LISTENERS = 50

const liveSubscriptions = new Map<string, LiveSubscription>()
const activeConfigs = new Map<string, string>()
const inFlightStarts = new Map<
  string,
  { fingerprint: string; generation: number; promise: Promise<void> }
>()
const startGenerations = new Map<string, number>()
// Monotonic across resets so a start from before a reset never looks current.
const generationSequence = { value: 0 }
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
const retryAttempts = new Map<string, number>()
const processorOverrides = new Map<string, NostrMessageProcessor>()

const emitter = new EventEmitter()
emitter.setMaxListeners(NOSTR_SYNC_EMITTER_MAX_LISTENERS)

function subscriptionKey(purpose: NostrSyncPurpose, accountId: string) {
  return `${purpose}:${accountId}`
}

function nowSeconds(): number {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function emitStatus(
  accountId: string,
  status: NostrSyncStatus,
  lastError?: NostrErrorCode
): void {
  const event: NostrSyncStatusEvent = { accountId, lastError, status }
  useNostrStore.getState().setSyncStatus(accountId, {
    lastError,
    ...(status === 'syncing' && { lastSyncAt: Date.now() }),
    status
  })
  emitter.emit('status', event)
}

function getLatestAccount(accountId: string): Account | undefined {
  return useAccountsStore.getState().accounts.find((a) => a.id === accountId)
}

function isReadyForSync(account: Account | undefined): account is ReadyAccount {
  const nostr = account?.nostr
  return Boolean(
    nostr?.autoSync &&
    nostr.relays?.length &&
    nostr.commonNsec &&
    nostr.commonNpub &&
    nostr.deviceNsec &&
    nostr.deviceNpub
  )
}

/** Relays and keys a running sync was opened with; a change means restart. */
function getSyncConfigFingerprint(account: ReadyAccount): string {
  const { commonNpub, deviceNpub, relays } = account.nostr
  return [commonNpub, deviceNpub, ...relays.toSorted()].join('|')
}

function nextGeneration(accountId: string): number {
  generationSequence.value += 1
  startGenerations.set(accountId, generationSequence.value)
  return generationSequence.value
}

function isCurrentGeneration(accountId: string, generation: number): boolean {
  return startGenerations.get(accountId) === generation
}

function getCursor(purpose: NostrSyncPurpose, accountId: string): number {
  const state = useNostrStore.getState()
  const cursor =
    purpose === 'protocol'
      ? state.getLastProtocolEOSE(accountId)
      : state.getLastDataExchangeEOSE(accountId)
  return cursor || 0
}

function setCursor(
  purpose: NostrSyncPurpose,
  accountId: string,
  timestamp: number
): void {
  const state = useNostrStore.getState()
  if (purpose === 'protocol') {
    state.setLastProtocolEOSE(accountId, timestamp)
    return
  }
  state.setLastDataExchangeEOSE(accountId, timestamp)
}

/**
 * The EOSE cursor follows the newest processed rumor, never wall-clock time,
 * and stays below the oldest event that failed so the next sync fetches it
 * again (moving back is safe: processed wraps are skipped before decrypt).
 */
function computeEoseCursor(
  current: number,
  progress: NostrCursorProgress
): number {
  const advanced = Math.max(current, progress.newestProcessed)
  if (progress.oldestFailed === null) {
    return advanced
  }
  return Math.min(advanced, progress.oldestFailed - 1)
}

/** A rumor's created_at is sender-controlled; never let it pass "now". */
function clampToNow(createdAt: number): number {
  return Math.min(createdAt, nowSeconds() + NOSTR_EVENT_FUTURE_TOLERANCE_SEC)
}

function recordBatchProgress(
  progress: NostrCursorProgress,
  result: Pick<NostrBatchResult, 'failed' | 'processed'> | undefined
): void {
  if (!result) {
    return
  }
  for (const event of result.processed) {
    progress.newestProcessed = Math.max(
      progress.newestProcessed,
      clampToNow(event.createdAt)
    )
  }
  for (const event of result.failed) {
    const createdAt = clampToNow(event.createdAt)
    progress.oldestFailed = Math.min(
      progress.oldestFailed ?? createdAt,
      createdAt
    )
  }
}

function runProcessor(
  accountId: string,
  messages: NostrMessage[]
): Promise<NostrBatchResult | undefined> {
  const account = getLatestAccount(accountId)
  if (!account) {
    return Promise.resolve(undefined)
  }
  const processor = processorOverrides.get(accountId) ?? processNostrEventBatch
  return processor(account, messages)
}

function getPurposeKeys(account: ReadyAccount, purpose: NostrSyncPurpose) {
  const { commonNpub, commonNsec, deviceNpub, deviceNsec } = account.nostr
  return purpose === 'protocol'
    ? { npub: commonNpub, nsec: commonNsec }
    : { npub: deviceNpub, nsec: deviceNsec }
}

function getSubscriptionLimit(
  purpose: NostrSyncPurpose,
  cursor: number
): number | undefined {
  if (purpose !== 'protocol') {
    return undefined
  }
  return cursor > 0
    ? NOSTR_PROTOCOL_SUBSCRIPTION_LIMIT
    : NOSTR_PROTOCOL_SUBSCRIPTION_LIMIT_FULL_SCAN
}

/**
 * Opens one gift-wrap subscription and resolves once it is live. The
 * returned `eose` promise resolves when the relays finished the backlog and
 * every queued event was processed, after the cursor was committed.
 */
async function openSubscription(
  account: ReadyAccount,
  purpose: NostrSyncPurpose,
  onLoadingChange?: LoadingCallback
): Promise<{ api: NostrAPI; eose: Promise<void> }> {
  const { npub, nsec } = getPurposeKeys(account, purpose)
  const cursor = getCursor(purpose, account.id)
  const progress: NostrCursorProgress = {
    newestProcessed: 0,
    oldestFailed: null
  }
  const eoseSignal: { resolve?: () => void; seen: boolean } = { seen: false }
  const eose = new Promise<void>((resolve) => {
    eoseSignal.resolve = resolve
  })
  const api = new NostrAPI(account.nostr.relays)
  if (onLoadingChange) {
    api.setLoadingCallback(onLoadingChange)
  }

  // Wraps processed in an earlier session are skipped before decrypt, so
  // their rumor times only reach the cursor through the processed table.
  function commitWhenDrained(remaining: number) {
    if (!eoseSignal.seen || remaining > 0) {
      return
    }
    progress.newestProcessed = Math.max(
      progress.newestProcessed,
      clampToNow(getNewestProcessedCreatedAt(account.id) ?? 0)
    )
    setCursor(
      purpose,
      account.id,
      computeEoseCursor(getCursor(purpose, account.id), progress)
    )
    eoseSignal.resolve?.()
  }

  // A throwing processor counts the whole batch as failed so the cursor
  // stays below it; rethrowing makes the queue forget the wraps for a retry.
  async function processor(messages: NostrMessage[]) {
    const store = useNostrStore.getState()
    store.incrementMessagesReceived(account.id, messages.length)
    try {
      const result = await runProcessor(account.id, messages)
      recordBatchProgress(progress, result)
      store.incrementMessagesProcessed(
        account.id,
        result?.processed.length ?? 0
      )
    } catch (error) {
      recordBatchProgress(progress, {
        failed: messages.map((message) => ({
          createdAt: message.created_at,
          id: message.id
        })),
        processed: []
      })
      throw error
    } finally {
      commitWhenDrained(api.getQueuedEventCount())
    }
  }

  function onEose() {
    eoseSignal.seen = true
    commitWhenDrained(api.getPendingEventCount())
  }

  await api.subscribeToKind1059(
    nsec,
    npub,
    processor,
    getSubscriptionLimit(purpose, cursor),
    cursor,
    onEose,
    { processedScope: account.id }
  )
  return { api, eose }
}

async function closeApi(api: NostrAPI): Promise<void> {
  await api.flushQueue().catch(() => undefined)
  api.closeAllSubscriptions()
}

function registerLiveSubscription(subscription: LiveSubscription): void {
  const key = subscriptionKey(subscription.purpose, subscription.accountId)
  const previous = liveSubscriptions.get(key)
  liveSubscriptions.set(key, subscription)
  if (previous && previous.api !== subscription.api) {
    void closeApi(previous.api)
  }
}

async function closeAccountSubscriptions(accountId: string): Promise<void> {
  const subscriptions = SYNC_PURPOSES.flatMap((purpose) => {
    const key = subscriptionKey(purpose, accountId)
    const subscription = liveSubscriptions.get(key)
    liveSubscriptions.delete(key)
    return subscription ? [subscription] : []
  })
  activeConfigs.delete(accountId)
  useNostrStore.getState().setSyncing(accountId, false)
  await Promise.allSettled(subscriptions.map(({ api }) => closeApi(api)))
}

function hasActiveSubscription(accountId: string): boolean {
  return SYNC_PURPOSES.some((purpose) =>
    liveSubscriptions.has(subscriptionKey(purpose, accountId))
  )
}

function cancelRetry(accountId: string): void {
  const timer = retryTimers.get(accountId)
  if (timer) {
    clearTimeout(timer)
    retryTimers.delete(accountId)
  }
}

function scheduleRetry(accountId: string, run: () => void): void {
  const attempt = retryAttempts.get(accountId) ?? 0
  if (attempt >= NOSTR_DEFAULT_RETRY_CONFIG.maxRetries) {
    return
  }
  cancelRetry(accountId)
  const timer = setTimeout(
    () => {
      retryTimers.delete(accountId)
      retryAttempts.set(accountId, attempt + 1)
      run()
    },
    calculateRetryDelay(attempt, NOSTR_DEFAULT_RETRY_CONFIG)
  )
  retryTimers.set(accountId, timer)
}

function markSyncHealthy(accountId: string): void {
  retryAttempts.delete(accountId)
  cancelRetry(accountId)
}

/**
 * Opens both purposes. When one fails the other is closed, and a start that
 * was superseded (stop or newer start) closes whatever it already opened.
 */
async function openAccountSubscriptions(
  account: ReadyAccount,
  generation: number,
  onLoadingChange?: LoadingCallback
): Promise<void> {
  const results = await Promise.allSettled(
    SYNC_PURPOSES.map((purpose) =>
      openSubscription(account, purpose, onLoadingChange)
    )
  )
  const opened = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value.api] : []
  )
  const failure = results.find((result) => result.status === 'rejected')
  if (failure || !isCurrentGeneration(account.id, generation)) {
    await Promise.allSettled(opened.map(closeApi))
  }
  if (failure) {
    throw failure.reason
  }
  if (!isCurrentGeneration(account.id, generation)) {
    return
  }
  for (const [index, api] of opened.entries()) {
    registerLiveSubscription({
      accountId: account.id,
      api,
      purpose: SYNC_PURPOSES[index]
    })
  }
}

async function doStartSync(
  accountId: string,
  fingerprint: string,
  generation: number,
  onLoadingChange?: LoadingCallback
): Promise<void> {
  if (hasActiveSubscription(accountId)) {
    await closeAccountSubscriptions(accountId)
  }
  const account = getLatestAccount(accountId)
  if (!isReadyForSync(account) || !isCurrentGeneration(accountId, generation)) {
    return
  }
  emitStatus(accountId, 'connecting')
  await openAccountSubscriptions(account, generation, onLoadingChange)
  if (!isCurrentGeneration(accountId, generation)) {
    return
  }
  activeConfigs.set(accountId, fingerprint)
  markSyncHealthy(accountId)
  useNostrStore.getState().setSyncing(accountId, true)
  emitStatus(accountId, 'syncing')
}

/**
 * Starts (or keeps) the live device sync for an account, reading the latest
 * account from the store. Idempotent: a running or starting sync with the
 * same relays and keys is left alone; a changed config replaces it.
 */
function startSync(
  accountId: string,
  onLoadingChange?: LoadingCallback
): Promise<void> {
  const account = getLatestAccount(accountId)
  if (!isReadyForSync(account)) {
    return Promise.resolve()
  }
  const fingerprint = getSyncConfigFingerprint(account)
  const inFlight = inFlightStarts.get(accountId)
  if (inFlight?.fingerprint === fingerprint) {
    return inFlight.promise
  }
  if (
    !inFlight &&
    activeConfigs.get(accountId) === fingerprint &&
    hasActiveSubscription(accountId)
  ) {
    return Promise.resolve()
  }

  const generation = nextGeneration(accountId)
  const promise = runStart(accountId, fingerprint, generation, onLoadingChange)
  inFlightStarts.set(accountId, { fingerprint, generation, promise })
  return promise
}

async function runStart(
  accountId: string,
  fingerprint: string,
  generation: number,
  onLoadingChange?: LoadingCallback
): Promise<void> {
  try {
    await doStartSync(accountId, fingerprint, generation, onLoadingChange)
  } catch (error) {
    if (isCurrentGeneration(accountId, generation)) {
      emitStatus(accountId, 'error', getNostrErrorCode(error))
      scheduleRetry(accountId, () => {
        void startSync(accountId, onLoadingChange)
      })
    }
  } finally {
    if (inFlightStarts.get(accountId)?.generation === generation) {
      inFlightStarts.delete(accountId)
    }
  }
}

function rejectAfter(ms: number): {
  cancel: () => void
  promise: Promise<never>
} {
  const handle: { timer?: ReturnType<typeof setTimeout> } = {}
  const promise = new Promise<never>((_resolve, reject) => {
    handle.timer = setTimeout(() => {
      reject(new NostrRelayTimeoutError('Relays did not finish in time'))
    }, ms)
  })
  return { cancel: () => clearTimeout(handle.timer), promise }
}

async function doFetchOnce(
  account: ReadyAccount,
  onLoadingChange?: LoadingCallback
): Promise<void> {
  const results = await Promise.allSettled(
    SYNC_PURPOSES.map((purpose) =>
      openSubscription(account, purpose, onLoadingChange)
    )
  )
  const opened = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : []
  )
  const deadline = rejectAfter(NOSTR_EOSE_TIMEOUT_MS)
  try {
    const failure = results.find((result) => result.status === 'rejected')
    if (failure) {
      throw failure.reason
    }
    await Promise.race([
      Promise.all(opened.map(({ eose }) => eose)),
      deadline.promise
    ])
  } finally {
    deadline.cancel()
    await Promise.allSettled(opened.map(({ api }) => closeApi(api)))
  }
}

/** One-shot catch-up (e.g. pull-to-refresh): fetch the backlog, then close. */
async function fetchOnce(
  accountId: string,
  onLoadingChange?: LoadingCallback
): Promise<void> {
  const account = getLatestAccount(accountId)
  if (!isReadyForSync(account)) {
    return
  }
  if (hasActiveSubscription(accountId)) {
    await restartSync(accountId, onLoadingChange)
    return
  }
  emitStatus(accountId, 'syncing')
  try {
    await doFetchOnce(account, onLoadingChange)
    markSyncHealthy(accountId)
    emitStatus(accountId, 'idle')
  } catch (error) {
    emitStatus(accountId, 'error', getNostrErrorCode(error))
    scheduleRetry(accountId, () => {
      void fetchOnce(accountId, onLoadingChange)
    })
  }
}

function setMessageProcessor(
  accountId: string,
  processor: NostrMessageProcessor
): void {
  processorOverrides.set(accountId, processor)
}

/** Stops the account sync, cancelling any start still in flight. */
async function stopSync(accountId: string): Promise<void> {
  nextGeneration(accountId)
  inFlightStarts.delete(accountId)
  cancelRetry(accountId)
  retryAttempts.delete(accountId)
  await closeAccountSubscriptions(accountId)
  emitStatus(accountId, 'idle')
}

async function restartSync(
  accountId: string,
  onLoadingChange?: LoadingCallback
): Promise<void> {
  await stopSync(accountId)
  await startSync(accountId, onLoadingChange)
}

/**
 * Trust was just granted. Stop first so a draining queue cannot write the
 * previous session's cursor back, then drop processed events and the
 * data-exchange cursor so history skipped while the device was untrusted
 * is fetched again.
 */
async function resyncDataExchangeAfterTrust(
  accountId: string,
  onLoadingChange?: LoadingCallback
): Promise<void> {
  await stopSync(accountId)
  const store = useNostrStore.getState()
  store.clearProcessedEvents(accountId)
  store.setLastDataExchangeEOSE(accountId, 0)
  await startSync(accountId, onLoadingChange)
}

function getSyncedAccountIds(): string[] {
  const ids = [...liveSubscriptions.values()].map(
    (subscription) => subscription.accountId
  )
  return [...new Set(ids)]
}

/** Live API instances (used by the lifecycle to probe liveness). */
function getLiveApis(accountId: string): NostrAPI[] {
  return SYNC_PURPOSES.flatMap((purpose) => {
    const subscription = liveSubscriptions.get(
      subscriptionKey(purpose, accountId)
    )
    return subscription ? [subscription.api] : []
  })
}

async function stopAll(): Promise<void> {
  const accountIds = new Set([
    ...getSyncedAccountIds(),
    ...inFlightStarts.keys(),
    ...retryTimers.keys()
  ])
  await Promise.allSettled([...accountIds].map(stopSync))
  for (const timer of retryTimers.values()) {
    clearTimeout(timer)
  }
  retryTimers.clear()
  retryAttempts.clear()
  inFlightStarts.clear()
}

function getCursorAge(
  purpose: NostrSyncPurpose,
  accountId: string,
  now: number
): number | null {
  const cursor = getCursor(purpose, accountId)
  return cursor > 0 ? now - cursor : null
}

/** Per-account sync state for the diagnostics screen. */
function getNostrSyncDiagnostics(): NostrSyncDiagnostics[] {
  const { syncStatus } = useNostrStore.getState()
  const accountIds = new Set([
    ...Object.keys(syncStatus),
    ...getSyncedAccountIds()
  ])
  const now = nowSeconds()
  return [...accountIds].map((accountId) => {
    const status = useNostrStore.getState().getSyncStatus(accountId)
    const apis = getLiveApis(accountId)
    return {
      accountId,
      activeSubscriptionKeys: SYNC_PURPOSES.map((purpose) =>
        subscriptionKey(purpose, accountId)
      ).filter((key) => liveSubscriptions.has(key)),
      eoseCursorAges: {
        dataExchange: getCursorAge('dataExchange', accountId, now),
        protocol: getCursorAge('protocol', accountId, now)
      },
      lastErrorCode: status.lastError ?? null,
      queueLength: apis.reduce(
        (sum, api) => sum + api.getPendingEventCount(),
        0
      ),
      status: status.status
    }
  })
}

/** Reset the sync service state (tests, developer reset, restore). */
async function resetInstance(): Promise<void> {
  processorOverrides.clear()
  await stopAll()
}

export const nostrSyncService = Object.assign(emitter, {
  fetchOnce,
  getActiveAccountIds: getSyncedAccountIds,
  getActiveSubscriptionCount: () => getSyncedAccountIds().length,
  getLiveApis,
  hasActiveSubscription,
  resetInstance,
  restartSync,
  resyncDataExchangeAfterTrust,
  setMessageProcessor,
  startSync,
  stopAll,
  stopSync
})

export {
  computeEoseCursor,
  getNostrSyncDiagnostics,
  getSyncConfigFingerprint,
  isReadyForSync,
  resetInstance
}
export type { NostrCursorProgress, NostrSyncDiagnostics, NostrSyncPurpose }
