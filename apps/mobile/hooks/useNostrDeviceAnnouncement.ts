import { useCallback, useMemo } from 'react'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { type Account } from '@/types/models/Account'
import { compressMessage } from '@/utils/nostr'

async function publishAnnouncement(
  nostrApi: NostrAPI,
  commonNsec: string,
  commonNpub: string,
  compressedMessage: string
) {
  try {
    const eventKind1059 = nostrApi.createKind1059(
      commonNsec,
      commonNpub,
      compressedMessage
    )
    await nostrApi.publishEvent(eventKind1059)
    return true
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to publish announcement'
    toast.error('Failed to publish announcement', { description: message })
    return false
  } finally {
    await nostrApi.closeAllSubscriptions()
  }
}

function useNostrDeviceAnnouncement() {
  const announce = useCallback(
    async (
      account?: Account,
      options?: { force?: boolean }
    ): Promise<boolean> => {
      if (!account || !account.nostr) {
        return false
      }
      if (!options?.force && !account.nostr.autoSync) {
        return false
      }
      const { commonNsec, commonNpub, deviceNpub, relays } = account.nostr

      if (!commonNsec || !commonNpub || relays.length === 0 || !deviceNpub) {
        toast.error('Missing required Nostr configuration')
        return false
      }

      const messageContent = {
        created_at: Math.floor(Date.now() / MS_PER_SECOND),
        public_key_bech32: deviceNpub
      }

      const compressedMessage = compressMessage(messageContent)
      const nostrApi = new NostrAPI(relays)
      await nostrApi.connect()

      return publishAnnouncement(
        nostrApi,
        commonNsec,
        commonNpub,
        compressedMessage
      )
    },
    []
  )

  return useMemo(() => ({ announce }), [announce])
}

export { useNostrDeviceAnnouncement }
