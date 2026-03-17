import { EventEmitter } from 'events'

import { NostrAPI } from '@/api/nostr'
import {
  DEFAULT_RETRY_CONFIG,
  EOSE_TIMEOUT_MS,
  PROTOCOL_SUBSCRIPTION_LIMIT
} from '@/constants/nostr'
import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import { type NostrMessage } from '@/types/models/Nostr'
import { calculateRetryDelay, type RetryConfig } from '@/utils/retryManager'

export type SyncStatus = 'idle' | 'connecting' | 'syncing' | 'error'

export type SyncStatusEvent = {
  accountId: string
  status: SyncStatus
  lastError?: string
  messagesProcessed?: number
  messagesReceived?: number
}

type SubscriptionHandle = {
  accountId: string
  dataExchangeApi: NostrAPI | null
  protocolApi: NostrAPI | null
}

const subscriptions = new Map<string, SubscriptionHandle>()
const retryTimers = new Map<string, NodeJS.Timeout>()
const retryAttempts = new Map<string, number>()
const isSubscribingMap = new Map<string, boolean>()
const messageProcessors = new Map<
  string,
  (messages: NostrMessage[]) => void | Promise<void>
>()

const emitter = new EventEmitter()
emitter.setMaxListeners(50)

function emitStatus(
  accountId: string,
  status: SyncStatus,
  lastError?: string
): void {
  const event: SyncStatusEvent = {
    accountId,
    status,
    lastError
  }
  useNostrStore.getState().setSyncStatus(accountId, {
    status,
    lastError,
    lastSyncAt: status === 'syncing' ? Date.now() : undefined
  })
  emitter.emit('status', event)
}

function cancelRetry(accountId: string): void {
  const timer = retryTimers.get(accountId)
  if (timer) {
    clearTimeout(timer)
    retryTimers.delete(accountId)
  }
}

function scheduleRetry(
  account: Account,
  onLoadingChange?: (loading: boolean) => void,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): void {
  const currentAttempt = retryAttempts.get(account.id) || 0

  if (currentAttempt >= config.maxRetries) {
    emitStatus(account.id, 'error', 'Max retry attempts reached')
    return
  }

  const delay = calculateRetryDelay(currentAttempt, config)
  cancelRetry(account.id)

  const timer = setTimeout(() => {
    retryAttempts.set(account.id, currentAttempt + 1)
    startSync(account, onLoadingChange)
  }, delay)

  retryTimers.set(account.id, timer)
}

async function createProtocolSubscription(
  account: Account,
  processor: (messages: NostrMessage[]) => void | Promise<void>,
  onLoadingChange?: (loading: boolean) => void
): Promise<NostrAPI | null> {
  const { commonNsec, commonNpub, relays } = account.nostr

  if (!commonNsec || !commonNpub || !relays?.length) {
    return null
  }

  const lastProtocolEOSE =
    useNostrStore.getState().getLastProtocolEOSE(account.id) || 0

  const nostrApi = new NostrAPI(relays)
  if (onLoadingChange) {
    nostrApi.setLoadingCallback(onLoadingChange)
  }

  await nostrApi.connect()
  await nostrApi.subscribeToKind1059(
    commonNsec,
    commonNpub,
    processor,
    undefined,
    lastProtocolEOSE,
    () => {
      const timestamp = Math.floor(Date.now() / 1000)
      useNostrStore.getState().setLastProtocolEOSE(account.id, timestamp)
    }
  )

  return nostrApi
}

async function createDataExchangeSubscription(
  account: Account,
  processor: (messages: NostrMessage[]) => void | Promise<void>,
  onLoadingChange?: (loading: boolean) => void
): Promise<NostrAPI | null> {
  const { deviceNsec, deviceNpub, relays } = account.nostr

  if (!deviceNsec || !deviceNpub || !relays?.length) {
    return null
  }

  const lastDataExchangeEOSE =
    useNostrStore.getState().getLastDataExchangeEOSE(account.id) || 0

  const nostrApi = new NostrAPI(relays)
  if (onLoadingChange) {
    nostrApi.setLoadingCallback(onLoadingChange)
  }

  await nostrApi.connect()
  await nostrApi.subscribeToKind1059(
    deviceNsec,
    deviceNpub,
    processor,
    undefined,
    lastDataExchangeEOSE,
    () => {
      const timestamp = Math.floor(Date.now() / 1000)
      useNostrStore.getState().setLastDataExchangeEOSE(account.id, timestamp)
    }
  )

  return nostrApi
}

async function cleanupSubscription(accountId: string): Promise<void> {
  const handle = subscriptions.get(accountId)
  if (!handle) return

  subscriptions.delete(accountId)
  useNostrStore.getState().setSyncing(accountId, false)

  const cleanupPromises: Promise<void>[] = []

  if (handle.protocolApi) {
    cleanupPromises.push(
      handle.protocolApi.flushQueue().catch(() => {}),
      handle.protocolApi.closeAllSubscriptions().catch(() => {})
    )
  }

  if (handle.dataExchangeApi) {
    cleanupPromises.push(
      handle.dataExchangeApi.flushQueue().catch(() => {}),
      handle.dataExchangeApi.closeAllSubscriptions().catch(() => {})
    )
  }

  await Promise.allSettled(cleanupPromises)
}

async function doStartSync(
  account: Account,
  onLoadingChange?: (loading: boolean) => void
): Promise<void> {
  const { autoSync, commonNsec, commonNpub, deviceNsec, deviceNpub, relays } =
    account.nostr || {}

  if (!autoSync) return
  if (!relays?.length) return
  if (!commonNsec || !commonNpub || !deviceNsec || !deviceNpub) return
  if (isSubscribingMap.get(account.id)) return
  if (subscriptions.has(account.id)) return

  isSubscribingMap.set(account.id, true)
  emitStatus(account.id, 'connecting')

  try {
    const processor = messageProcessors.get(account.id)
    if (!processor) {
      throw new Error('No message processor registered for account')
    }

    const [protocolApi, dataExchangeApi] = await Promise.all([
      createProtocolSubscription(account, processor, onLoadingChange),
      createDataExchangeSubscription(account, processor, onLoadingChange)
    ])

    subscriptions.set(account.id, {
      protocolApi,
      dataExchangeApi,
      accountId: account.id
    })

    retryAttempts.delete(account.id)
    cancelRetry(account.id)

    useNostrStore.getState().setSyncing(account.id, true)
    emitStatus(account.id, 'syncing')
  } finally {
    isSubscribingMap.set(account.id, false)
  }
}

async function doFetchOnce(
  account: Account,
  onLoadingChange?: (loading: boolean) => void
): Promise<void> {
  const { autoSync, commonNsec, commonNpub, deviceNsec, deviceNpub, relays } =
    account.nostr || {}

  if (!autoSync) return
  if (!relays?.length || !commonNsec || !commonNpub) return

  emitStatus(account.id, 'syncing')

  const processor = messageProcessors.get(account.id)
  if (!processor) {
    throw new Error('No message processor registered for account')
  }

  const protocolApi = new NostrAPI(relays)
  const dataExchangeApi = deviceNsec && deviceNpub ? new NostrAPI(relays) : null

  if (onLoadingChange) {
    protocolApi.setLoadingCallback(onLoadingChange)
    dataExchangeApi?.setLoadingCallback(onLoadingChange)
  }

  try {
    const lastProtocolEOSE =
      useNostrStore.getState().getLastProtocolEOSE(account.id) || 0
    const lastDataExchangeEOSE =
      useNostrStore.getState().getLastDataExchangeEOSE(account.id) || 0

    let resolveProtocolEose!: () => void
    const protocolEosePromise = new Promise<void>(
      (resolve) => (resolveProtocolEose = resolve)
    )

    let resolveDataExchangeEose!: () => void
    const dataExchangeEosePromise = dataExchangeApi
      ? new Promise<void>((resolve) => (resolveDataExchangeEose = resolve))
      : Promise.resolve()

    await Promise.all([
      protocolApi.connect().then(() =>
        protocolApi.subscribeToKind1059(
          commonNsec,
          commonNpub,
          processor,
          PROTOCOL_SUBSCRIPTION_LIMIT,
          lastProtocolEOSE,
          () => {
            const timestamp = Math.floor(Date.now() / 1000)
            useNostrStore.getState().setLastProtocolEOSE(account.id, timestamp)
            resolveProtocolEose()
          }
        )
      ),
      dataExchangeApi
        ? dataExchangeApi.connect().then(() =>
            dataExchangeApi.subscribeToKind1059(
              deviceNsec!,
              deviceNpub!,
              processor,
              undefined,
              lastDataExchangeEOSE,
              () => {
                const timestamp = Math.floor(Date.now() / 1000)
                useNostrStore
                  .getState()
                  .setLastDataExchangeEOSE(account.id, timestamp)
                resolveDataExchangeEose()
              }
            )
          )
        : Promise.resolve()
    ])

    const timeout = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms))

    await Promise.all([
      Promise.race([protocolEosePromise, timeout(EOSE_TIMEOUT_MS)]),
      Promise.race([dataExchangeEosePromise, timeout(EOSE_TIMEOUT_MS)])
    ])

    await Promise.all([protocolApi.flushQueue(), dataExchangeApi?.flushQueue()])
    await Promise.all([
      protocolApi.closeAllSubscriptions(),
      dataExchangeApi?.closeAllSubscriptions()
    ])

    emitStatus(account.id, 'idle')
  } catch (err) {
    await Promise.allSettled([
      protocolApi.closeAllSubscriptions(),
      dataExchangeApi?.closeAllSubscriptions()
    ])
    throw err
  }
}

function setMessageProcessor(
  accountId: string,
  processor: (messages: NostrMessage[]) => void | Promise<void>
): void {
  messageProcessors.set(accountId, processor)
}

function startSync(
  account: Account,
  onLoadingChange?: (loading: boolean) => void
): void {
  doStartSync(account, onLoadingChange).catch((err) => {
    emitStatus(
      account.id,
      'error',
      err instanceof Error ? err.message : String(err)
    )
    scheduleRetry(account, onLoadingChange)
  })
}

function fetchOnce(
  account: Account,
  onLoadingChange?: (loading: boolean) => void
): void {
  doFetchOnce(account, onLoadingChange).catch((err) => {
    emitStatus(
      account.id,
      'error',
      err instanceof Error ? err.message : String(err)
    )
  })
}

function stopSync(accountId: string): void {
  cleanupSubscription(accountId)
  cancelRetry(accountId)
  emitStatus(accountId, 'idle')
}

function restartSync(
  account: Account,
  onLoadingChange?: (loading: boolean) => void
): void {
  cleanupSubscription(account.id)
    .catch(() => {})
    .finally(() => {
      cancelRetry(account.id)
      emitStatus(account.id, 'idle')
      startSync(account, onLoadingChange)
    })
}

function stopAll(): void {
  const accountIds = Array.from(subscriptions.keys())
  for (const accountId of accountIds) {
    stopSync(accountId)
  }
  retryTimers.forEach((timer) => clearTimeout(timer))
  retryTimers.clear()
  retryAttempts.clear()
  isSubscribingMap.clear()
}

function hasActiveSubscription(accountId: string): boolean {
  return subscriptions.has(accountId)
}

function getActiveAccountIds(): string[] {
  return Array.from(subscriptions.keys())
}

function getActiveSubscriptionCount(): number {
  return subscriptions.size
}

/**
 * Reset the sync service state (useful for testing).
 * Does not create a new instance; call stopAll and clear internal state.
 */
function resetInstance(): void {
  stopAll()
}

export const nostrSyncService = Object.assign(emitter, {
  fetchOnce,
  getActiveAccountIds,
  getActiveSubscriptionCount,
  hasActiveSubscription,
  resetInstance,
  restartSync,
  setMessageProcessor,
  startSync,
  stopAll,
  stopSync
})

export { resetInstance }
