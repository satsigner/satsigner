import { useCallback } from 'react'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { type Account } from '@/types/models/Account'
import { compressMessage } from '@/utils/nostr'

function useNostrDeviceAnnouncement() {
  const announce = useCallback(async (account?: Account) => {
    if (!account?.nostr?.autoSync) return
    if (!account || !account.nostr) return
    const { commonNsec, commonNpub, deviceNpub, relays } = account.nostr

    if (!commonNsec || !commonNpub || relays.length === 0 || !deviceNpub) {
      toast.error('Missing required Nostr configuration')
      return
    }

    const messageContent = {
      created_at: Math.floor(Date.now() / 1000),
      public_key_bech32: deviceNpub
    }

    const compressedMessage = compressMessage(messageContent)
    const nostrApi = new NostrAPI(relays)
    await nostrApi.connect()

    try {
      const eventKind1059 = await nostrApi.createKind1059(
        commonNsec,
        commonNpub,
        compressedMessage
      )
      await nostrApi.publishEvent(eventKind1059)
    } catch {
      // Error already shown as toast in NostrAPI.publishEvent
    }
  }, [])

  return {
    announce
  }
}

export { useNostrDeviceAnnouncement }
export default useNostrDeviceAnnouncement
