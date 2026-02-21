import { type Network } from 'bdk-rn/lib/lib/enums'
import { useCallback } from 'react'

import { getWalletData } from '@/api/bdk'
import type { Account } from '@/types/models/Account'
import { getAccountWithDecryptedKeys } from '@/utils/account'
import { type Label } from '@/utils/bip329'
import { deriveNostrKeysFromDescriptor } from '@/utils/nostr'

import { useNostrDeviceAnnouncement } from './nostr/useNostrDeviceAnnouncement'
import { useNostrDMStorage } from './nostr/useNostrDMStorage'
import { useNostrLabelSync } from './nostr/useNostrLabelSync'
import { useNostrMessageProcessor } from './nostr/useNostrMessageProcessor'
import { useNostrSubscriptionManager } from './nostr/useNostrSubscriptionManager'

function useNostrSync() {
  const subscriptions = useNostrSubscriptionManager()
  const messages = useNostrMessageProcessor()
  const labels = useNostrLabelSync()
  const dms = useNostrDMStorage()
  const device = useNostrDeviceAnnouncement()

  const generateCommonNostrKeys = useCallback(async (account?: Account) => {
    if (!account?.keys?.length) return

    const isImportAddress = account.keys[0].creationType === 'importAddress'
    const tmpAccount = await getAccountWithDecryptedKeys(account)
    if (isImportAddress) {
      const secret = tmpAccount.keys[0].secret
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
  const nostrSyncSubscriptions = subscriptions.subscribe
  const cleanupSubscriptions = subscriptions.cleanup
  const protocolSubscription = subscriptions.createProtocolSubscription
  const dataExchangeSubscription = subscriptions.createDataExchangeSubscription
  const getActiveSubscriptions = subscriptions.getActiveSubscriptions
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
    // New clean API
    subscribe: subscriptions.subscribe,
    cleanup: subscriptions.cleanup,
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
