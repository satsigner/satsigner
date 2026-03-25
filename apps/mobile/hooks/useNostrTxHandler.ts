import { toast } from 'sonner-native'

import { type MessageHandler } from '@/types/nostrMessageHandlers'

import {
  getAuthorDisplayName,
  isChatActive,
  TOAST_CONTENT_MAX,
  TOAST_DURATION
} from './useNostrNotifyUtils'

const txHandler: MessageHandler = {
  canHandle: (context) => {
    return context.data?.data_type === 'Tx'
  },

  handle: async (context) => {
    const { unwrappedEvent, data, account } = context
    if (!data) return

    const dataStr = String(data.data ?? '')
    const author = getAuthorDisplayName(unwrappedEvent.pubkey)
    const preview = dataStr.slice(0, TOAST_CONTENT_MAX)

    if (!isChatActive(account.id)) {
      toast.info('New Transaction', {
        description: `${author}\n${preview}`,
        duration: TOAST_DURATION
      })
    }
  }
}

export { txHandler }
