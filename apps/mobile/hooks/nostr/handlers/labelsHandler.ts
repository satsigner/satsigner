import { toast } from 'sonner-native'

import { useAccountsStore } from '@/store/accounts'
import { JSONLtoLabels } from '@/utils/bip329'

import { type MessageHandler } from '../types'

const labelsHandler: MessageHandler = {
  canHandle: (context) => {
    return context.data?.data_type === 'LabelsBip329'
  },

  handle: async (context) => {
    const { account, data } = context
    if (!data) return

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
  }
}

export { labelsHandler }
