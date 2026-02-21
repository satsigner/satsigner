import { nip19 } from 'nostr-tools'
import { toast } from 'sonner-native'

import { type MessageHandler } from '../types'

const signMessageHandler: MessageHandler = {
  canHandle: (context) => {
    return context.data?.data_type === 'SignMessageRequest'
  },

  handle: async (context) => {
    const { unwrappedEvent, data } = context
    if (!data) return

    const dataStr = String(data.data ?? '')
    const npub = nip19.npubEncode(unwrappedEvent.pubkey)
    const formattedAuthor = `${npub.slice(0, 12)}...${npub.slice(-4)}`

    toast.info(
      `New Sign message request Recieve from: ${formattedAuthor} - ${dataStr.slice(0, 12)}...`
    )
  }
}

export { signMessageHandler }
