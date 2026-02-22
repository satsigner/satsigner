import { type Network } from 'bdk-rn/lib/lib/enums'
import { useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { PIN_KEY } from '@/config/auth'
import { nostrSyncService } from '@/services/nostr'
import { getItem } from '@/storage/encrypted'
import { useNostrStore } from '@/store/nostr'
import { type Account, type Secret } from '@/types/models/Account'
import { type Label } from '@/utils/bip329'
import { aesDecrypt } from '@/utils/crypto'
import { deriveNostrKeysFromDescriptor } from '@/utils/nostr'

import { useNostrDeviceAnnouncement } from './nostr/useNostrDeviceAnnouncement'
import { useNostrDMStorage } from './nostr/useNostrDMStorage'
import { useNostrLabelSync } from './nostr/useNostrLabelSync'
import { useNostrMessageProcessor } from './nostr/useNostrMessageProcessor'
import { useNostrSubscriptionManager } from './nostr/useNostrSubscriptionManager'

/**
 * Hook for Nostr synchronization with fire-and-forget operations.
 * All sync operations return immediately and update status via events.
 */
function useNostrSync() {
  const subscriptionManager = useNostrSubscriptionManager()
  const messages = useNostrMessageProcessor()
  const labels = useNostrLabelSync()
  const dms = useNostrDMStorage()
  const device = useNostrDeviceAnnouncement()

  const [getSyncStatus] = useNostrStore(
    useShallow((state) => [state.getSyncStatus])
  )

  // Register message processor with the service when this hook is used
  useEffect(() => {
    // This is a no-op effect that ensures the message processor is available
    // The actual registration happens when startSync is called
  }, [messages])

  /**
   * Start sync for an account - fire-and-forget (non-blocking)
   * Use this for persistent subscriptions (e.g., when entering chat screen)
   */
  const startSync = useCallback(
    (account: Account, onLoadingChange?: (loading: boolean) => void) => {
      // Register the message processor for this account
      nostrSyncService.setMessageProcessor(
        account.id,
        (msgs) => messages.processEventBatch(account, msgs)
      )
      // Fire-and-forget - returns immediately
      nostrSyncService.startSync(account, onLoadingChange)
    },
    [messages]
  )

  /**
   * Fetch once for an account - fire-and-forget (non-blocking)
   * Use this for one-shot syncs (e.g., pull-to-refresh on wallet screen)
   */
  const fetchOnce = useCallback(
    (account: Account, onLoadingChange?: (loading: boolean) => void) => {
      // Register the message processor for this account
      nostrSyncService.setMessageProcessor(
        account.id,
        (msgs) => messages.processEventBatch(account, msgs)
      )
      // Fire-and-forget - returns immediately
      nostrSyncService.fetchOnce(account, onLoadingChange)
    },
    [messages]
  )

  /**
   * Stop sync for an account
   * Use this when leaving a screen that had active sync
   */
  const stopSync = useCallback((accountId: string) => {
    nostrSyncService.stopSync(accountId)
  }, [])

  /**
   * Check if an account has active subscriptions
   */
  const hasActiveSubscription = useCallback((accountId: string) => {
    return nostrSyncService.hasActiveSubscription(accountId)
  }, [])

  /**
   * Get sync status for an account
   */
  const getStatus = useCallback(
    (accountId: string) => {
      return getSyncStatus(accountId)
    },
    [getSyncStatus]
  )

  const generateCommonNostrKeys = useCallback(async (account?: Account) => {
    if (!account?.keys?.length) return

    const pin = await getItem(PIN_KEY)
    if (!pin) return

    const firstKey = account.keys[0]
    if (!firstKey?.secret || !firstKey.iv) return

    const isImportAddress = firstKey.creationType === 'importAddress'
    const temporaryAccount = JSON.parse(JSON.stringify(account)) as Account

    for (const key of temporaryAccount.keys) {
      if (typeof key.secret !== 'string' || !key.iv) return
      const decryptedSecretString = await aesDecrypt(key.secret, pin, key.iv)
      const decryptedSecret = JSON.parse(decryptedSecretString) as Secret
      if (!decryptedSecret) return
      key.secret = decryptedSecret
    }

    if (isImportAddress) {
      const secret = temporaryAccount.keys[0].secret as Secret
      if (!secret?.externalDescriptor) return
      return {
        externalDescriptor: secret.externalDescriptor,
        internalDescriptor: undefined
      }
    }

    if (!temporaryAccount.network) return
    const walletData = await getWalletData(
      temporaryAccount,
      temporaryAccount.network as Network
    )
    if (!walletData?.externalDescriptor) {
      throw new Error('Failed to get wallet data')
    }

    return deriveNostrKeysFromDescriptor(walletData.externalDescriptor)
  }, [])

  // Legacy API mappings for backward compatibility with consumers
  // The subscription manager is still used for some operations
  const nostrSyncSubscriptions = subscriptionManager.subscribe
  const cleanupSubscriptions = subscriptionManager.cleanup
  const protocolSubscription = subscriptionManager.createProtocolSubscription
  const dataExchangeSubscription = subscriptionManager.createDataExchangeSubscription
  const getActiveSubscriptions = subscriptionManager.getActiveSubscriptions

  const sendLabelsToNostr = useCallback(
    async (account?: Account, singleLabel?: Label) => {
      await labels.sync(account, singleLabel)
    },
    [labels]
  )

  const loadStoredDMs = dms.load
  const clearStoredDMs = dms.clear
  const processEvent = messages.processEvent
  const deviceAnnouncement = device.announce

  return {
    // New fire-and-forget API
    startSync,
    fetchOnce,
    stopSync,
    hasActiveSubscription,
    getStatus,

    // Clean API from the plan
    subscribe: subscriptionManager.subscribe,
    cleanup: subscriptionManager.cleanup,
    syncLabels: labels.sync,
    storeDM: dms.store,
    loadDMs: dms.load,
    clearDMs: dms.clear,
    announceDevice: device.announce,
    generateKeys: generateCommonNostrKeys,

    // Legacy API for backward compatibility
    sendLabelsToNostr,
    dataExchangeSubscription,
    generateCommonNostrKeys,
    loadStoredDMs,
    clearStoredDMs,
    processEvent,
    protocolSubscription,
    cleanupSubscriptions,
    deviceAnnouncement,
    nostrSyncSubscriptions,
    getActiveSubscriptions
  }
}

export default useNostrSync
