import { nip19 } from 'nostr-tools'
import { useMemo } from 'react'

import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type NostrDM } from '@/types/models/Nostr'
import { parseNostrTransactionMessage } from '@/utils/nostr'

type UseNostrMessageParams = {
  msg: NostrDM
  account: Account | undefined
  formattedNpubs: Map<string, { text: string; color: string }>
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
        text: `${msgAuthorNpub.slice(0, 12)}...${msgAuthorNpub.slice(-4)}`,
        color: '#404040'
      }

      const messageContent =
        typeof msg.content === 'object' && 'description' in msg.content
          ? msg.content.description
          : typeof msg.content === 'string'
            ? msg.content
            : t('account.nostrSync.devicesGroupChat.displayError')

      const transactionData = parseNostrTransactionMessage(messageContent)
      const hasSignFlow = transactionData !== null

      const formattedDate = new Date(msg.created_at * 1000).toLocaleString(
        'en-US',
        {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }
      )

      return {
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
        isDeviceMessage: false,
        authorDisplayName: { text: '', color: '' },
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
