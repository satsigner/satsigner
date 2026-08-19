import { toast } from 'sonner-native'

import { useAccountsStore } from '@/store/accounts'
import { type NostrMsgHandler } from '@/types/models/Nostr'
import { JSONLtoLabels } from '@/utils/bip329'

import { isSenderAllowed } from './useNostrDMStorage'

const labelsHandler: NostrMsgHandler = {
  canHandle: (context) => context.data?.data_type === 'LabelsBip329',

  handle: (context) => {
    const { account, data, unwrappedEvent } = context
    if (!data) {
      return
    }

    // Labels are persisted with last-writer-wins semantics, so only accept
    // them from the account's own device or explicitly trusted member
    // devices — otherwise anyone able to reach the account (e.g. a relay
    // that learned its device npubs) could silently rewrite labels.
    const currentAccount = useAccountsStore
      .getState()
      .accounts.find((a) => a.id === account.id)
    if (
      !currentAccount ||
      !isSenderAllowed(currentAccount, unwrappedEvent.pubkey)
    ) {
      return
    }

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
