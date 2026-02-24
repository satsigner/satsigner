import { toast } from 'sonner-native'

import { type MessageHandler } from '../types'
import {
  TOAST_CONTENT_MAX,
  TOAST_DURATION,
  getAuthorDisplayName,
  isChatActive
} from './notifyUtils'

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
