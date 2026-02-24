import { toast } from 'sonner-native'

import { type MessageHandler } from '../types'
import {
  TOAST_CONTENT_MAX,
  TOAST_DURATION,
  getAuthorDisplayName
} from './notifyUtils'

const signMessageHandler: MessageHandler = {
  canHandle: (context) => {
    return context.data?.data_type === 'SignMessageRequest'
  },

  handle: async (context) => {
    const { unwrappedEvent, data } = context
    if (!data) return

    const dataStr = String(data.data ?? '')
    const author = getAuthorDisplayName(unwrappedEvent.pubkey)
    const preview = dataStr.slice(0, TOAST_CONTENT_MAX)

    toast.info('New Sign Request', {
      description: `${author}\n${preview}`,
      duration: TOAST_DURATION
    })
  }
}

export { signMessageHandler }
