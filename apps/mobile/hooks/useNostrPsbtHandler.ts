import { toast } from 'sonner-native'

import { type MessageHandler } from '@/types/nostrMessageHandlers'

import {
  getAuthorDisplayName,
  isChatActive,
  TOAST_CONTENT_MAX,
  TOAST_DURATION
} from './useNostrNotifyUtils'

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

    // Normalize and validate external fields before storing
    const rawCreatedAt = eventContent.created_at
    const coercedCreatedAt = Number(rawCreatedAt)
    const created_at =
      typeof coercedCreatedAt === 'number' &&
      !Number.isNaN(coercedCreatedAt) &&
      coercedCreatedAt > 0
        ? Math.floor(coercedCreatedAt)
        : Math.floor(Date.now() / 1000)

    const rawDescription = data.data
    const description =
      typeof rawDescription === 'string'
        ? rawDescription.trim()
        : String(rawDescription ?? '').trim()
    const DESCRIPTION_MAX = 2000
    const safeDescription =
      description.length > DESCRIPTION_MAX
        ? description.slice(0, DESCRIPTION_MAX)
        : description || ''

    const psbtEventContent: Record<string, unknown> = {
      created_at,
      description: safeDescription
    }

    onPendingDM({
      unwrappedEvent,
      eventContent: psbtEventContent,
      skipToast: true
    })
  }
}

export { psbtHandler }
