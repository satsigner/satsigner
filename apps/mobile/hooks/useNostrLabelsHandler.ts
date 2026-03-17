import { toast } from 'sonner-native'

import { useAccountsStore } from '@/store/accounts'
import { type MessageHandler } from '@/types/nostrMessageHandlers'
import { JSONLtoLabels } from '@/utils/bip329'

const labelsHandler: MessageHandler = {
  canHandle: (context) => {
    return context.data?.data_type === 'LabelsBip329'
  },

  handle: async (context) => {
    const { account, data } = context
    if (!data) return

    try {
      const labels = JSONLtoLabels(String(data.data ?? ''))
      const labelsAdded = useAccountsStore
        .getState()
        .importLabels(account.id, labels)

      if (labelsAdded > 0) {
        toast.success(
          labelsAdded === 1
            ? `Imported ${labelsAdded} label`
            : `Imported ${labelsAdded} labels`
        )
      }
    } catch {
      toast.error('Failed to import labels')
    }
  }
}

export { labelsHandler }
