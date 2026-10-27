import { toast } from 'sonner-native'

import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Label } from '@/types/bips/329'
import { type NostrMsgHandler } from '@/types/models/Nostr'
import { JSONLtoLabels } from '@/utils/bip329'

import { isSenderAllowed } from './useNostrDMStorage'

/** Malformed payloads are permanent failures: report them, don't retry. */
function parseLabels(jsonl: string): Label[] | null {
  try {
    return JSONLtoLabels(jsonl)
  } catch {
    return null
  }
}

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

    const labels = parseLabels(String(data.data ?? ''))
    if (!labels) {
      toast.error(t('account.nostrSync.labelsImportFailed'))
      return
    }
    // A failed import throws, leaving the event unprocessed for a retry.
    const labelsAdded = useAccountsStore
      .getState()
      .importLabels(account.id, labels)

    if (labelsAdded > 0) {
      toast.success(
        t('account.nostrSync.labelsImported', { count: labelsAdded })
      )
    }
  }
}

export { labelsHandler }
