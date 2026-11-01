import {
  NOSTR_FALLBACK_NPUB_COLOR,
  NOSTR_PUBKEY_HEX_LENGTH
} from '@/constants/nostr'
import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type NostrDM } from '@/types/models/Nostr'
import { formatDateShort } from '@/utils/date'
import { formatNpub } from '@/utils/format'
import { parseNostrTransaction, safeNpubEncode } from '@/utils/nostr'

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
  /** npub treated as "you" when there is no bitcoin account (DM chats). */
  ownNpub?: string
}

function getMessageContent(msg: NostrDM): string {
  if (typeof msg.content === 'object' && 'description' in msg.content) {
    return msg.content.description
  }
  if (typeof msg.content === 'string') {
    return msg.content
  }
  return t('account.nostrSync.devicesGroupChat.displayError')
}

/** Callers that already hold npub authors (DM threads) skip the encode. */
function getAuthorNpub(author: string): string {
  if (author.startsWith('npub')) {
    return author
  }
  return safeNpubEncode(
    author.padStart(NOSTR_PUBKEY_HEX_LENGTH, '0').toLowerCase(),
    ''
  )
}

function getNostrMessageDisplay({
  msg,
  account,
  formattedNpubs,
  ownNpub
}: UseNostrMessageParams) {
  const authorNpub = getAuthorNpub(msg.author)
  const messageContent = getMessageContent(msg)
  const transactionData = parseNostrTransaction(messageContent)

  return {
    authorDisplayName: formattedNpubs.get(msg.author) ?? {
      color: NOSTR_FALLBACK_NPUB_COLOR,
      npubShort: formatNpub(authorNpub)
    },
    authorNpub,
    error: authorNpub ? null : new Error('Invalid Nostr message author'),
    formattedDate: formatDateShort(msg.created_at),
    hasSignFlow: transactionData !== null,
    isDeviceMessage: authorNpub === (account?.nostr?.deviceNpub ?? ownNpub),
    messageContent,
    transactionData
  }
}

export function useNostrMessage(params: UseNostrMessageParams) {
  return getNostrMessageDisplay(params)
}
