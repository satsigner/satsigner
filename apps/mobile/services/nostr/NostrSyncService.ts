import { EventEmitter } from 'events'

import { NostrAPI, PROTOCOL_SUBSCRIPTION_LIMIT } from '@/api/nostr'
import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import { type NostrMessage } from '@/types/models/Nostr'

import { calculateRetryDelay, type RetryConfig } from './RetryManager'

type SyncStatus = 'idle' | 'connecting' | 'syncing' | 'error'

interface SyncStatusEvent {
  accountId: string
  status: SyncStatus
  lastError?: string
  messagesReceived?: number
  messagesProcessed?: number
}

interface SubscriptionHandle {
  protocolApi: NostrAPI | null
  dataExchangeApi: NostrAPI | null
  accountId: string
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  maxRetries: 5,
  jitterFactor: 0.2
}

/**
 * Singleton service for managing Nostr sync operations.
 * All operations are fire-and-forget (non-blocking) with event-based status updates.
 */
class NostrSyncService extends EventEmitter {
  private static instance: NostrSyncService | null = null
  private subscriptions: Map<string, SubscriptionHandle> = new Map()
  private retryTimers: Map<string, NodeJS.Timeout> = new Map()
  private retryAttempts: Map<string, number> = new Map()
  private isSubscribingMap: Map<string, boolean> = new Map()
  private messageProcessors: Map<
    string,
    (messages: NostrMessage[]) => void | Promise<void>
  > = new Map()

  private constructor() {
    super()
    // Set max listeners to avoid warnings with multiple accounts
    this.setMaxListeners(50)
  }

  static getInstance(): NostrSyncService {
    if (!NostrSyncService.instance) {
      NostrSyncService.instance = new NostrSyncService()
    }
    return NostrSyncService.instance
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    if (NostrSyncService.instance) {
      NostrSyncService.instance.stopAll()
      NostrSyncService.instance = null
    }
  }

  /**
   * Register a message processor for an account
   */
  setMessageProcessor(
    accountId: string,
    processor: (messages: NostrMessage[]) => void | Promise<void>
  ): void {
    this.messageProcessors.set(accountId, processor)
  }

  /**
   * Fire-and-forget sync start - returns immediately
   * Starts both protocol and data-exchange subscriptions
   */
  startSync(
    account: Account,
    onLoadingChange?: (loading: boolean) => void
  ): void {
    this.doStartSync(account, onLoadingChange).catch((err) => {
      this.emitStatus(
        account.id,
        'error',
        err instanceof Error ? err.message : String(err)
      )
      this.scheduleRetry(account, onLoadingChange)
    })
  }

  /**
   * One-shot fetch for wallet sync - fire-and-forget
   * Does not maintain persistent subscription
   */
  fetchOnce(
    account: Account,
    onLoadingChange?: (loading: boolean) => void
  ): void {
    this.doFetchOnce(account, onLoadingChange).catch((err) => {
      this.emitStatus(
        account.id,
        'error',
        err instanceof Error ? err.message : String(err)
      )
    })
  }

  /**
   * Stop sync for a specific account
   */
  stopSync(accountId: string): void {
    this.cleanupSubscription(accountId)
    this.cancelRetry(accountId)
    this.emitStatus(accountId, 'idle')
  }

  /**
   * Restart sync for an account — stops any existing subscriptions and
   * immediately starts new ones using the current relay list on the account.
   * Use this when the relay list changes while autoSync is ON.
   */
  restartSync(
    account: Account,
    onLoadingChange?: (loading: boolean) => void
  ): void {
    this.cleanupSubscription(account.id)
      .catch(() => {})
      .finally(() => {
        this.cancelRetry(account.id)
        this.emitStatus(account.id, 'idle')
        this.startSync(account, onLoadingChange)
      })
  }

  /**
   * Stop all syncs
   */
  stopAll(): void {
    const accountIds = Array.from(this.subscriptions.keys())
    for (const accountId of accountIds) {
      this.stopSync(accountId)
    }
    this.retryTimers.forEach((timer) => clearTimeout(timer))
    this.retryTimers.clear()
    this.retryAttempts.clear()
    this.isSubscribingMap.clear()
  }

  /**
   * Check if an account has active subscriptions
   */
  hasActiveSubscription(accountId: string): boolean {
    return this.subscriptions.has(accountId)
  }

  /**
   * Get all active subscription account IDs
   */
  getActiveAccountIds(): string[] {
    return Array.from(this.subscriptions.keys())
  }

  /**
   * Get the count of active subscriptions
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size
  }

  private async doStartSync(
    account: Account,
    onLoadingChange?: (loading: boolean) => void
  ): Promise<void> {
    const { autoSync, commonNsec, commonNpub, deviceNsec, deviceNpub, relays } =
      account.nostr || {}

    if (!autoSync) return

    if (!relays?.length) return

    if (!commonNsec || !commonNpub || !deviceNsec || !deviceNpub) return

    // Guard against concurrent subscriptions
    if (this.isSubscribingMap.get(account.id)) return

    // Check if we already have valid subscriptions
    if (this.subscriptions.has(account.id)) return

    this.isSubscribingMap.set(account.id, true)
    this.emitStatus(account.id, 'connecting')

    try {
      const processor = this.messageProcessors.get(account.id)
      if (!processor) {
        throw new Error('No message processor registered for account')
      }

      // Create both subscriptions in parallel
      const [protocolApi, dataExchangeApi] = await Promise.all([
        this.createProtocolSubscription(account, processor, onLoadingChange),
        this.createDataExchangeSubscription(account, processor, onLoadingChange)
      ])

      this.subscriptions.set(account.id, {
        protocolApi,
        dataExchangeApi,
        accountId: account.id
      })

      // Clear retry state on success
      this.retryAttempts.delete(account.id)
      this.cancelRetry(account.id)

      // Update store
      useNostrStore.getState().setSyncing(account.id, true)
      this.emitStatus(account.id, 'syncing')
    } finally {
      this.isSubscribingMap.set(account.id, false)
    }
  }

  private async doFetchOnce(
    account: Account,
    onLoadingChange?: (loading: boolean) => void
  ): Promise<void> {
    const { autoSync, commonNsec, commonNpub, deviceNsec, deviceNpub, relays } =
      account.nostr || {}

    if (!autoSync) return

    if (!relays?.length || !commonNsec || !commonNpub) return

    this.emitStatus(account.id, 'syncing')

    const processor = this.messageProcessors.get(account.id)
    if (!processor) {
      throw new Error('No message processor registered for account')
    }

    const protocolApi = new NostrAPI(relays)
    const dataExchangeApi =
      deviceNsec && deviceNpub ? new NostrAPI(relays) : null

    if (onLoadingChange) {
      protocolApi.setLoadingCallback(onLoadingChange)
      dataExchangeApi?.setLoadingCallback(onLoadingChange)
    }

    // 15 s safety valve so we never hang if a relay never sends EOSE
    const EOSE_TIMEOUT_MS = 15000

    try {
      const lastProtocolEOSE =
        useNostrStore.getState().getLastProtocolEOSE(account.id) || 0
      const lastDataExchangeEOSE =
        useNostrStore.getState().getLastDataExchangeEOSE(account.id) || 0

      // Build EOSE promises BEFORE subscribing so the callbacks can resolve them
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
              useNostrStore
                .getState()
                .setLastProtocolEOSE(account.id, timestamp)
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

      // Wait for EOSE from both subscriptions before reading the queue.
      // A per-subscription timeout guards against relays that never send EOSE.
      const timeout = (ms: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, ms))

      await Promise.all([
        Promise.race([protocolEosePromise, timeout(EOSE_TIMEOUT_MS)]),
        Promise.race([dataExchangeEosePromise, timeout(EOSE_TIMEOUT_MS)])
      ])

      // Flush and close both
      await Promise.all([
        protocolApi.flushQueue(),
        dataExchangeApi?.flushQueue()
      ])
      await Promise.all([
        protocolApi.closeAllSubscriptions(),
        dataExchangeApi?.closeAllSubscriptions()
      ])

      this.emitStatus(account.id, 'idle')
    } catch (err) {
      await Promise.allSettled([
        protocolApi.closeAllSubscriptions(),
        dataExchangeApi?.closeAllSubscriptions()
      ])
      throw err
    }
  }

  private async createProtocolSubscription(
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

  private async createDataExchangeSubscription(
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

  private async cleanupSubscription(accountId: string): Promise<void> {
    const handle = this.subscriptions.get(accountId)
    if (!handle) return

    this.subscriptions.delete(accountId)
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

  private scheduleRetry(
    account: Account,
    onLoadingChange?: (loading: boolean) => void,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): void {
    const currentAttempt = this.retryAttempts.get(account.id) || 0

    if (currentAttempt >= config.maxRetries) {
      this.emitStatus(account.id, 'error', 'Max retry attempts reached')
      return
    }

    const delay = calculateRetryDelay(currentAttempt, config)
    this.cancelRetry(account.id)

    const timer = setTimeout(() => {
      this.retryAttempts.set(account.id, currentAttempt + 1)
      this.startSync(account, onLoadingChange)
    }, delay)

    this.retryTimers.set(account.id, timer)
  }

  private cancelRetry(accountId: string): void {
    const timer = this.retryTimers.get(accountId)
    if (timer) {
      clearTimeout(timer)
      this.retryTimers.delete(accountId)
    }
  }

  private emitStatus(
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
    this.emit('status', event)
  }
}

export const nostrSyncService = NostrSyncService.getInstance()
export { NostrSyncService }
export type { SyncStatus, SyncStatusEvent }
