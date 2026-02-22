import { EventEmitter } from 'events'

import {
  NostrAPI,
  PROTOCOL_SUBSCRIPTION_LIMIT
} from '@/api/nostr'
import { useAccountsStore } from '@/store/accounts'
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

function nostrServiceLog(...args: unknown[]) {
  if (__DEV__) {
    console.log('[NostrSyncService]', ...args)
  }
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
  private messageProcessors: Map<string, (messages: NostrMessage[]) => void | Promise<void>> = new Map()

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
  startSync(account: Account, onLoadingChange?: (loading: boolean) => void): void {
    nostrServiceLog('startSync called', account.id)
    this.doStartSync(account, onLoadingChange).catch(err => {
      nostrServiceLog('startSync error', err)
      this.emitStatus(account.id, 'error', err instanceof Error ? err.message : String(err))
      this.scheduleRetry(account, onLoadingChange)
    })
  }

  /**
   * One-shot fetch for wallet sync - fire-and-forget
   * Does not maintain persistent subscription
   */
  fetchOnce(account: Account, onLoadingChange?: (loading: boolean) => void): void {
    nostrServiceLog('fetchOnce called', account.id)
    this.doFetchOnce(account, onLoadingChange).catch(err => {
      nostrServiceLog('fetchOnce error', err)
      this.emitStatus(account.id, 'error', err instanceof Error ? err.message : String(err))
    })
  }

  /**
   * Stop sync for a specific account
   */
  stopSync(accountId: string): void {
    nostrServiceLog('stopSync called', accountId)
    this.cleanupSubscription(accountId)
    this.cancelRetry(accountId)
    this.emitStatus(accountId, 'idle')
  }

  /**
   * Stop all syncs
   */
  stopAll(): void {
    nostrServiceLog('stopAll called')
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
    const { autoSync, commonNsec, commonNpub, deviceNsec, deviceNpub, relays } = account.nostr || {}

    if (!autoSync) {
      nostrServiceLog('doStartSync skip: autoSync disabled')
      return
    }

    if (!relays?.length) {
      nostrServiceLog('doStartSync skip: no relays')
      return
    }

    if (!commonNsec || !commonNpub || !deviceNsec || !deviceNpub) {
      nostrServiceLog('doStartSync skip: missing keys')
      return
    }

    // Guard against concurrent subscriptions
    if (this.isSubscribingMap.get(account.id)) {
      nostrServiceLog('doStartSync skip: already subscribing')
      return
    }

    // Check if we already have valid subscriptions
    if (this.subscriptions.has(account.id)) {
      nostrServiceLog('doStartSync skip: subscription exists')
      return
    }

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

      nostrServiceLog('doStartSync complete', account.id)
    } finally {
      this.isSubscribingMap.set(account.id, false)
    }
  }

  private async doFetchOnce(
    account: Account,
    onLoadingChange?: (loading: boolean) => void
  ): Promise<void> {
    const { autoSync, commonNsec, commonNpub, relays } = account.nostr || {}

    if (!autoSync) {
      nostrServiceLog('doFetchOnce skip: autoSync disabled')
      return
    }

    if (!relays?.length || !commonNsec || !commonNpub) {
      nostrServiceLog('doFetchOnce skip: missing config')
      return
    }

    this.emitStatus(account.id, 'syncing')

    const processor = this.messageProcessors.get(account.id)
    if (!processor) {
      throw new Error('No message processor registered for account')
    }

    const nostrApi = new NostrAPI(relays)
    if (onLoadingChange) {
      nostrApi.setLoadingCallback(onLoadingChange)
    }

    try {
      await nostrApi.connect()

      const lastProtocolEOSE = useNostrStore.getState().getLastProtocolEOSE(account.id) || 0

      await nostrApi.subscribeToKind1059(
        commonNsec,
        commonNpub,
        processor,
        PROTOCOL_SUBSCRIPTION_LIMIT,
        lastProtocolEOSE,
        () => {
          const timestamp = Math.floor(Date.now() / 1000)
          useNostrStore.getState().setLastProtocolEOSE(account.id, timestamp)
        }
      )

      // Flush and close
      await nostrApi.flushQueue()
      await nostrApi.closeAllSubscriptions()

      this.emitStatus(account.id, 'idle')
      nostrServiceLog('doFetchOnce complete', account.id)
    } catch (err) {
      await nostrApi.closeAllSubscriptions().catch(() => {})
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

    const lastProtocolEOSE = useNostrStore.getState().getLastProtocolEOSE(account.id) || 0

    const nostrApi = new NostrAPI(relays)
    if (onLoadingChange) {
      nostrApi.setLoadingCallback(onLoadingChange)
    }

    await nostrApi.connect()
    await nostrApi.subscribeToKind1059(
      commonNsec,
      commonNpub,
      processor,
      PROTOCOL_SUBSCRIPTION_LIMIT,
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

    const lastDataExchangeEOSE = useNostrStore.getState().getLastDataExchangeEOSE(account.id) || 0

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
    nostrServiceLog('cleanupSubscription done', accountId)
  }

  private scheduleRetry(
    account: Account,
    onLoadingChange?: (loading: boolean) => void,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): void {
    const currentAttempt = this.retryAttempts.get(account.id) || 0

    if (currentAttempt >= config.maxRetries) {
      nostrServiceLog('scheduleRetry max attempts reached', account.id)
      this.emitStatus(account.id, 'error', 'Max retry attempts reached')
      return
    }

    const delay = calculateRetryDelay(currentAttempt, config)
    nostrServiceLog('scheduleRetry', account.id, 'attempt', currentAttempt + 1, 'delay', delay)

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
