import { getWalletData } from '@/api/bdk'
import { useNostrStore } from '@/store/nostr'
import { type Label } from '@/types/bips/329'
import type { Account } from '@/types/models/Account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { getAccountWithDecryptedKeys } from '@/utils/decryption'
import { resolveDescriptorForNostrCommonKeys } from '@/utils/getOutputDescriptorForKey'
import { deriveNostrKeysFromDescriptor } from '@/utils/nostr'
import { nostrSyncService } from '@/utils/nostrSyncService'

import { useNostrDeviceAnnouncement } from './useNostrDeviceAnnouncement'
import { useNostrDMStorage } from './useNostrDMStorage'
import { useNostrLabelSync } from './useNostrLabelSync'
import { useNostrMessageProcessor } from './useNostrMessageProcessor'

type LoadingCallback = (loading: boolean) => void

async function generateCommonNostrKeys(account?: Account) {
  if (!account?.keys?.length) {
    return
  }

  const tmpAccount = await getAccountWithDecryptedKeys(account)
  const [firstKey] = tmpAccount.keys
  const { secret } = firstKey

  const walletData = await getWalletData(
    tmpAccount,
    appNetworkToBdkNetwork(tmpAccount.network)
  )

  const externalDescriptor = await resolveDescriptorForNostrCommonKeys(
    tmpAccount,
    firstKey,
    secret,
    walletData
  )

  if (!externalDescriptor) {
    throw new Error('Failed to get wallet data')
  }

  if (/^addr\(/i.test(externalDescriptor)) {
    throw new Error(
      'Label sync needs a wallet descriptor; single imported addresses are not supported'
    )
  }

  return deriveNostrKeysFromDescriptor(externalDescriptor)
}

/**
 * Device sync entry points for screens. Sync operations go through
 * nostrSyncService, which reads the latest account from the store and keeps
 * one live subscription per purpose and account.
 */
function useNostrSync() {
  const messages = useNostrMessageProcessor()
  const labels = useNostrLabelSync()
  const dms = useNostrDMStorage()
  const device = useNostrDeviceAnnouncement()
  const getSyncStatus = useNostrStore((state) => state.getSyncStatus)

  function startSync(accountId: string, onLoadingChange?: LoadingCallback) {
    void nostrSyncService.startSync(accountId, onLoadingChange)
  }

  function fetchOnce(accountId: string, onLoadingChange?: LoadingCallback) {
    void nostrSyncService.fetchOnce(accountId, onLoadingChange)
  }

  function stopSync(accountId: string) {
    void nostrSyncService.stopSync(accountId)
  }

  function restartSync(accountId: string, onLoadingChange?: LoadingCallback) {
    void nostrSyncService.restartSync(accountId, onLoadingChange)
  }

  async function sendLabelsToNostr(account?: Account, singleLabel?: Label) {
    await labels.sync(account, singleLabel)
  }

  return {
    announceDevice: device.announce,
    clearStoredDMs: dms.clear,
    deviceAnnouncement: device.announce,
    fetchOnce,
    generateCommonNostrKeys,
    getStatus: getSyncStatus,
    hasActiveSubscription: nostrSyncService.hasActiveSubscription,
    loadStoredDMs: dms.load,
    processEvent: messages.processEvent,
    restartSync,
    sendLabelsToNostr,
    startSync,
    stopSync,
    storeDM: dms.store,
    syncLabels: labels.sync
  }
}

export default useNostrSync
