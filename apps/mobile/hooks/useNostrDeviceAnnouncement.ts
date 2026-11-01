import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { compressMessage } from '@/utils/nostr'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'

/** Publishes this device's npub to the shared (descriptor) key. */
async function announceNostrDevice(
  account?: Account,
  options?: { force?: boolean }
): Promise<boolean> {
  if (!account?.nostr) {
    return false
  }
  if (!options?.force && !account.nostr.autoSync) {
    return false
  }
  const { commonNsec, commonNpub, deviceNpub, relays } = account.nostr
  if (!commonNsec || !commonNpub || relays.length === 0 || !deviceNpub) {
    toast.error(t('common.error.missingRequiredNostrConfig'))
    return false
  }

  const compressedMessage = compressMessage({
    created_at: Math.floor(Date.now() / MS_PER_SECOND),
    public_key_bech32: deviceNpub
  })
  const nostrApi = new NostrAPI(relays)
  try {
    await nostrApi.connect()
    await nostrApi.publishEvent(
      nostrApi.createKind1059(commonNsec, commonNpub, compressedMessage)
    )
    return true
  } catch (error) {
    toast.error(t('account.nostrSync.announcementFailed'), {
      description: getNostrErrorMessage(error)
    })
    return false
  } finally {
    nostrApi.closeAllSubscriptions()
  }
}

function useNostrDeviceAnnouncement() {
  return { announce: announceNostrDevice }
}

export { announceNostrDevice, useNostrDeviceAnnouncement }
