import { useCallback } from 'react'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { formatAccountLabels, type Label, labelsToJSONL } from '@/utils/bip329'
import { sha256 } from '@/utils/crypto'
import { compressMessage } from '@/utils/nostr'

function useNostrLabelSync() {
  const sync = useCallback(async (account?: Account, singleLabel?: Label) => {
    if (!account || !account.nostr || !account.nostr.autoSync) return
    const { commonNsec, commonNpub, relays, deviceNpub, deviceNsec } =
      account.nostr

    if (
      !commonNsec ||
      commonNpub === '' ||
      relays.length === 0 ||
      !deviceNpub ||
      !deviceNsec
    ) {
      return
    }

    let labels: Label[] = []
    if (singleLabel) {
      // For single label, we need to get all current labels and add the new one
      labels = formatAccountLabels(account)
      labels.push(singleLabel)
    } else {
      labels = formatAccountLabels(account)
    }

    // Always check fingerprint for both single and bulk cases
    const message = labelsToJSONL(labels)
    const hash = await sha256(message)
    const fingerprint = hash.slice(0, 8)

    // Only skip if it's not a single label and fingerprint matches
    if (!singleLabel && fingerprint === account.nostr.lastBackupFingerprint) {
      return
    }

    if (labels.length === 0) {
      toast.error(t('account.nostrSync.errorMissingData'))
      return
    }

    const labelPackage = labels.map((label) => ({
      __class__: 'Label',
      VERSION: '0.0.3',
      type: label.type,
      ref: label.ref,
      label: label.label,
      spendable: label.spendable,
      timestamp: Math.floor(Date.now() / 1000)
    }))

    const labelPackageJSONL = labelsToJSONL(labelPackage)
    const messageContent = {
      created_at: Math.floor(Date.now() / 1000),
      label: 1,
      description: 'Here come some labels',
      data: { data: labelPackageJSONL, data_type: 'LabelsBip329' }
    }

    const compressedMessage = compressMessage(messageContent)
    const nostrApi = new NostrAPI(relays)
    await nostrApi.connect()

    // Get trusted devices from current account state
    const currentAccount = useAccountsStore
      .getState()
      .accounts.find((a) => a.id === account.id)
    const trustedDevices = currentAccount?.nostr?.trustedMemberDevices || []

    if (trustedDevices.length === 0) {
      return
    }

    try {
      // Parallel sending to all trusted devices using Promise.allSettled
      const publishPromises = trustedDevices.map(async (trustedDeviceNpub) => {
        const eventKind1059 = await nostrApi.createKind1059(
          deviceNsec,
          trustedDeviceNpub,
          compressedMessage
        )
        return nostrApi.publishEvent(eventKind1059)
      })

      await Promise.allSettled(publishPromises)
    } catch {
      // Error already shown as toast in NostrAPI.publishEvent
    }
  }, [])

  return {
    sync
  }
}

export { useNostrLabelSync }
export default useNostrLabelSync
