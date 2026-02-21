import { type Network } from 'bdk-rn/lib/lib/enums'
import { useCallback } from 'react'

import { getWalletData } from '@/api/bdk'
import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { type Account, type Secret } from '@/types/models/Account'
import { type Label } from '@/utils/bip329'
import { aesDecrypt } from '@/utils/crypto'
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
