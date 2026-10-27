import { toast } from 'sonner-native'

import { t } from '@/locales'
import { type NostrMsgHandler } from '@/types/models/Nostr'

import { isSenderAllowedForAccount } from './useNostrDMStorage'
import {
  getAuthorDisplayName,
  isChatActive,
  TOAST_CONTENT_MAX,
  TOAST_DURATION
} from './useNostrNotifyUtils'

const txHandler: NostrMsgHandler = {
  canHandle: (context) => context.data?.data_type === 'Tx',

  handle: (context) => {
    const { unwrappedEvent, data, account } = context
    // Only the account's own and trusted devices may notify or store.
    if (
      !data ||
      !isSenderAllowedForAccount(account.id, unwrappedEvent.pubkey)
    ) {
      return
    }

    const dataStr = String(data.data ?? '')
    const author = getAuthorDisplayName(unwrappedEvent.pubkey)
    const preview = dataStr.slice(0, TOAST_CONTENT_MAX)

    if (!isChatActive(account.id)) {
      toast.info(t('account.nostrSync.newTransaction'), {
        description: `${author}\n${preview}`,
        duration: TOAST_DURATION
      })
    }
  }
}

export { txHandler }
