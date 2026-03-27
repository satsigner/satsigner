import { type Network } from 'bdk-rn/lib/lib/enums'
import { useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { useNostrStore } from '@/store/nostr'
import type { Account } from '@/types/models/Account'
import { getAccountWithDecryptedKeys } from '@/utils/account'
import { type Label } from '@/utils/bip329'
import { deriveNostrKeysFromDescriptor } from '@/utils/nostr'
import { nostrSyncService } from '@/utils/nostrSyncService'

import { useNostrDeviceAnnouncement } from './useNostrDeviceAnnouncement'
import { useNostrDMStorage } from './useNostrDMStorage'
import { useNostrLabelSync } from './useNostrLabelSync'
import { useNostrMessageProcessor } from './useNostrMessageProcessor'
import { useNostrSubscriptionManager } from './useNostrSubscriptionManager'

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

  /**
   * Start sync for an account - fire-and-forget (non-blocking)
   * Use this for persistent subscriptions (e.g., when entering chat screen)
   */
  const startSync = useCallback(
    (account: Account, onLoadingChange?: (loading: boolean) => void) => {
      // Register the message processor for this account
      nostrSyncService.setMessageProcessor(account.id, (msgs) =>
        messages.processEventBatch(account, msgs)
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
      nostrSyncService.setMessageProcessor(account.id, (msgs) =>
        messages.processEventBatch(account, msgs)
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
   * Restart sync for an account - fire-and-forget (non-blocking)
   * Use this when the relay list changes while autoSync is ON
   */
  const restartSync = useCallback(
    (account: Account, onLoadingChange?: (loading: boolean) => void) => {
      nostrSyncService.setMessageProcessor(account.id, (msgs) =>
        messages.processEventBatch(account, msgs)
      )
      nostrSyncService.restartSync(account, onLoadingChange)
    },
    [messages]
  )

  /**
   * Check if an account has active subscriptions
   */
  const hasActiveSubscription = useCallback(
    (accountId: string) => nostrSyncService.hasActiveSubscription(accountId),
    []
  )

  /**
   * Get sync status for an account
   */
  const getStatus = useCallback(
    (accountId: string) => getSyncStatus(accountId),
    [getSyncStatus]
  )

  const generateCommonNostrKeys = useCallback(async (account?: Account) => {
    if (!account?.keys?.length) {
      return
    }

    const isImportAddress = account.keys[0].creationType === 'importAddress'
    const tmpAccount = await getAccountWithDecryptedKeys(account)
    if (isImportAddress) {
      const [{ secret }] = tmpAccount.keys
      return {
        externalDescriptor: secret.externalDescriptor,
        internalDescriptor: undefined
      }
    }

    const walletData = await getWalletData(
      tmpAccount,
      tmpAccount.network as Network
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
  const dataExchangeSubscription =
    subscriptionManager.createDataExchangeSubscription
  const { getActiveSubscriptions } = subscriptionManager

  const sendLabelsToNostr = useCallback(
    async (account?: Account, singleLabel?: Label) => {
      await labels.sync(account, singleLabel)
    },
    [labels]
  )

  const loadStoredDMs = dms.load
  const clearStoredDMs = dms.clear
  const { processEvent } = messages
  const deviceAnnouncement = device.announce

  return useMemo(
    () => ({
      announceDevice: device.announce,
      cleanup: subscriptionManager.cleanup,
      cleanupSubscriptions,
      clearDMs: dms.clear,
      clearStoredDMs,
      dataExchangeSubscription,
      deviceAnnouncement,
      fetchOnce,
      generateCommonNostrKeys,
      generateKeys: generateCommonNostrKeys,
      getActiveSubscriptions,
      getStatus,
      hasActiveSubscription,
      loadDMs: dms.load,
      loadStoredDMs,
      nostrSyncSubscriptions,
      processEvent,
      protocolSubscription,
      restartSync,
      sendLabelsToNostr,
      startSync,
      stopSync,
      storeDM: dms.store,
      subscribe: subscriptionManager.subscribe,
      syncLabels: labels.sync
    }),
    [
      startSync,
      fetchOnce,
      stopSync,
      restartSync,
      hasActiveSubscription,
      getStatus,
      subscriptionManager,
      labels,
      dms,
      device,
      generateCommonNostrKeys,
      sendLabelsToNostr,
      dataExchangeSubscription,
      loadStoredDMs,
      clearStoredDMs,
      processEvent,
      protocolSubscription,
      cleanupSubscriptions,
      deviceAnnouncement,
      nostrSyncSubscriptions,
      getActiveSubscriptions
    ]
  )
}

export default useNostrSync
