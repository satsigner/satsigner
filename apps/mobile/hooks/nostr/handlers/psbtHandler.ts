import { nip19 } from 'nostr-tools'
import { toast } from 'sonner-native'

import { type MessageHandler, type PendingDM } from '../types'

type PSBTHandlerResult = {
  pendingDM?: PendingDM
}

function createPSBTHandler(
  onPendingDM: (dm: PendingDM) => void
): MessageHandler {
  return {
    canHandle: (context) => {
      return context.data?.data_type === 'PSBT'
    },

    handle: async (context) => {
      const { unwrappedEvent, eventContent, data } = context
      if (!data) return

      const dataStr = String(data.data ?? '')
      const npub = nip19.npubEncode(unwrappedEvent.pubkey)
      const formattedAuthor = `${npub.slice(0, 12)}...${npub.slice(-4)}`

      toast.info(
        `New PSBT received from: ${formattedAuthor} - ${dataStr.slice(0, 12)}...`
      )

      // Store PSBT as DM for display
      const psbtEventContent: Record<string, unknown> = {
        created_at:
          (eventContent.created_at as number) || Math.floor(Date.now() / 1000),
        description: data.data
      }

      onPendingDM({
        unwrappedEvent,
        eventContent: psbtEventContent
      })
    }
  }
}

export { createPSBTHandler }
export type { PSBTHandlerResult }
