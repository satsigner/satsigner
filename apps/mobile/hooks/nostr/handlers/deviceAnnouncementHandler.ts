import { useNostrStore } from '@/store/nostr'

import { type MessageHandler } from '../types'

const deviceAnnouncementHandler: MessageHandler = {
  canHandle: (context) => {
    return context.eventContent.public_key_bech32 != null
  },

  handle: async (context) => {
    const { account, eventContent } = context
    const newMember = eventContent.public_key_bech32 as string
    useNostrStore.getState().addMember(account.id, newMember)
  }
}

export { deviceAnnouncementHandler }
