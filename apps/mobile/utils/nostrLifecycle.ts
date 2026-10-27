import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription
} from 'react-native'

import { reconnectNdkForRelays } from '@/api/nostr'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { isReadyForSync, nostrSyncService } from '@/utils/nostrSyncService'

type NostrLifecycleHandler = {
  onActive?: () => void | Promise<void>
  onBackground?: () => void | Promise<void>
}

type NostrResumeRecord = {
  at: number
  restartedAccountIds: string[]
}

type LifecycleListeners = {
  appState?: NativeEventSubscription
  lastAppState?: AppStateStatus
  lastResume?: NostrResumeRecord
  netInfo?: () => void
  wasOnline?: boolean
}

const handlers = new Set<NostrLifecycleHandler>()
const listeners: LifecycleListeners = {}

/**
 * Lets another nostr pipeline (e.g. identity chat) react to the app coming
 * back or going to background. Returns the unregister function.
 */
function registerNostrLifecycleHandler(
  handler: NostrLifecycleHandler
): () => void {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

/**
 * Sockets can die silently while suspended, and NDK re-opens a dropped socket
 * without re-sending the REQs that were running on it (a liveness probe on a
 * fresh REQ would still answer). So every sync is re-subscribed; the service
 * re-issues the REQ with since = EOSE cursor (minus the NIP-59 jitter) and
 * already processed wraps are skipped before decrypt, so this is cheap.
 */
async function resumeAccountSync(accountId: string): Promise<boolean> {
  const account = useAccountsStore
    .getState()
    .accounts.find((a) => a.id === accountId)
  if (!isReadyForSync(account)) {
    return false
  }
  await reconnectNdkForRelays(account.nostr.relays).catch(() => undefined)
  await nostrSyncService.restartSync(accountId)
  return true
}

async function resumeAccountSyncSafely(accountId: string): Promise<boolean> {
  try {
    return await resumeAccountSync(accountId)
  } catch {
    return false
  }
}

/**
 * Accounts whose sync gave up after its retries (error, nothing live) get
 * another chance once the app is back or online.
 */
function getErroredAccountIds(): string[] {
  const { syncStatus } = useNostrStore.getState()
  return useAccountsStore
    .getState()
    .accounts.filter(
      (account) =>
        isReadyForSync(account) &&
        syncStatus[account.id]?.status === 'error' &&
        !nostrSyncService.hasActiveSubscription(account.id)
    )
    .map((account) => account.id)
}

async function resumeNostr(): Promise<void> {
  const accountIds = [
    ...new Set([
      ...nostrSyncService.getActiveAccountIds(),
      ...getErroredAccountIds()
    ])
  ]
  const [restarts] = await Promise.all([
    Promise.all(accountIds.map((id) => resumeAccountSyncSafely(id))),
    Promise.all([...handlers].map((handler) => invokeSafely(handler.onActive)))
  ])
  listeners.lastResume = {
    at: Date.now(),
    restartedAccountIds: accountIds.filter((_id, index) => restarts[index])
  }
}

async function invokeSafely(
  handlerStep?: () => void | Promise<void>
): Promise<void> {
  try {
    await handlerStep?.()
  } catch {
    // A failing pipeline handler must not stop the other handlers.
  }
}

function notifyBackground(): void {
  for (const handler of handlers) {
    void invokeSafely(handler.onBackground)
  }
}

function handleAppStateChange(next: AppStateStatus): void {
  const previous = listeners.lastAppState
  listeners.lastAppState = next
  if (next === previous) {
    return
  }
  if (next === 'active') {
    void resumeNostr()
    return
  }
  if (next === 'background') {
    notifyBackground()
  }
}

function handleConnectivityChange(state: NetInfoState): void {
  const online = state.isConnected !== false
  const { wasOnline } = listeners
  listeners.wasOnline = online
  if (online && wasOnline === false) {
    void resumeNostr()
  }
}

/** Registers the AppState and NetInfo listeners once per session. */
function startNostrLifecycle(): void {
  if (listeners.appState) {
    return
  }
  listeners.lastAppState = AppState.currentState
  listeners.appState = AppState.addEventListener('change', handleAppStateChange)
  listeners.netInfo = NetInfo.addEventListener(handleConnectivityChange)
}

function stopNostrLifecycle(): void {
  listeners.appState?.remove()
  listeners.netInfo?.()
  listeners.appState = undefined
  listeners.netInfo = undefined
  listeners.lastAppState = undefined
  listeners.wasOnline = undefined
}

function getNostrLifecycleDiagnostics() {
  return {
    handlerCount: handlers.size,
    lastResume: listeners.lastResume ?? null,
    running: Boolean(listeners.appState)
  }
}

export {
  getNostrLifecycleDiagnostics,
  registerNostrLifecycleHandler,
  resumeNostr,
  startNostrLifecycle,
  stopNostrLifecycle
}
export type { NostrLifecycleHandler }
