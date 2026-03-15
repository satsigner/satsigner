import { nip19 } from 'nostr-tools'
import { useMemo } from 'react'

import { NOSTR_FALLBACK_NPUB_COLOR } from '@/constants/nostr'
import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type NostrDM } from '@/types/models/Nostr'
import { formatDateShort } from '@/utils/date'
import { parseNostrTransaction } from '@/utils/nostr'

export type AuthorDisplayInfo = {
  displayName?: string
  alias?: string
  npubShort: string
  color: string
  picture?: string
}

type UseNostrMessageParams = {
  msg: NostrDM
  account: Account | undefined
  formattedNpubs: Map<string, AuthorDisplayInfo>
}

export function useNostrMessage({
  msg,
  account,
  formattedNpubs
}: UseNostrMessageParams) {
  const data = useMemo(() => {
    try {
      const hexString = msg.author.startsWith('npub')
        ? msg.author
        : msg.author.padStart(64, '0').toLowerCase()

      const msgAuthorNpub = msg.author.startsWith('npub')
        ? msg.author
        : nip19.npubEncode(hexString)

      const isDeviceMessage = msgAuthorNpub === account?.nostr?.deviceNpub
      const authorDisplayName = formattedNpubs.get(msg.author) || {
        npubShort: `${msgAuthorNpub.slice(0, 12)}...${msgAuthorNpub.slice(-4)}`,
        color: NOSTR_FALLBACK_NPUB_COLOR
      }

      const messageContent =
        typeof msg.content === 'object' && 'description' in msg.content
          ? msg.content.description
          : typeof msg.content === 'string'
            ? msg.content
            : t('account.nostrSync.devicesGroupChat.displayError')

      const transactionData = parseNostrTransaction(messageContent)
      const hasSignFlow = transactionData !== null

      const formattedDate = formatDateShort(msg.created_at)

      return {
        authorNpub: msgAuthorNpub,
        isDeviceMessage,
        authorDisplayName,
        messageContent,
        transactionData,
        hasSignFlow,
        formattedDate,
        error: null
      }
    } catch (error) {
      return {
        authorNpub: '',
        isDeviceMessage: false,
        authorDisplayName: { npubShort: '', color: '' },
        messageContent: '',
        transactionData: null,
        hasSignFlow: false,
        formattedDate: '',
        error:
          error instanceof Error
            ? error
            : new Error('Failed to process Nostr message')
      }
    }
  }, [msg, account, formattedNpubs])

  return data
}
