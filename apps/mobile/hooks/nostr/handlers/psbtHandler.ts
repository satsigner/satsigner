import { toast } from 'sonner-native'

import { type MessageHandler } from '../types'
import {
  TOAST_CONTENT_MAX,
  TOAST_DURATION,
  getAuthorDisplayName,
  isChatActive
} from './notifyUtils'

const psbtHandler: MessageHandler = {
  canHandle: (context) => {
    return context.data?.data_type === 'PSBT'
  },

  handle: async (context) => {
    const { unwrappedEvent, eventContent, data, onPendingDM, account } = context
    if (!data) return

    const dataStr = String(data.data ?? '')
    const author = getAuthorDisplayName(unwrappedEvent.pubkey)
    const preview = dataStr.slice(0, TOAST_CONTENT_MAX)

    if (!isChatActive(account.id)) {
      toast.info('New PSBT', {
        description: `${author}\n${preview}`,
        duration: TOAST_DURATION
      })
    }

    // Store PSBT as DM for display
    const psbtEventContent: Record<string, unknown> = {
      created_at:
        (eventContent.created_at as number) || Math.floor(Date.now() / 1000),
      description: data.data
    }

    onPendingDM({
      unwrappedEvent,
      eventContent: psbtEventContent,
      skipToast: true
    })
  }
}

export { psbtHandler }
