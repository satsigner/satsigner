import { nip19 } from 'nostr-tools'
import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSTransactionDetails from '@/components/SSTransactionDetails'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type NostrDM } from '@/types/models/Nostr'
import { parseNostrTransactionMessage } from '@/utils/nostr'

type SSNostrMessageProps = {
  item: NostrDM
  account: Account | undefined
  formattedNpubs: Map<string, { text: string; color: string }>
  visibleComponents: Map<string, { sankey: boolean; status: boolean }>
  onToggleVisibility: (msgId: string, component: 'sankey' | 'status') => void
  onGoToSignFlow: (messageContent: string) => void
}

function SSNostrMessage({
  item: msg,
  account,
  formattedNpubs,
  visibleComponents,
  onToggleVisibility,
  onGoToSignFlow
}: SSNostrMessageProps) {
  try {
    const hexString = msg.author.startsWith('npub')
      ? msg.author
      : msg.author.padStart(64, '0').toLowerCase()

    const msgAuthorNpub = msg.author.startsWith('npub')
      ? msg.author
      : nip19.npubEncode(hexString)

    const isDeviceMessage = msgAuthorNpub === account?.nostr?.deviceNpub
    const formatted = formattedNpubs.get(msg.author) || {
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

    const visibility = visibleComponents.get(msg.id) || {
      sankey: false,
      status: false
    }

    return (
      <SSVStack
        gap="xxs"
        style={[styles.message, isDeviceMessage && styles.deviceMessage]}
      >
        <SSHStack gap="xxs" justifyBetween>
          <SSHStack gap="xxs" style={{ alignItems: 'center' }}>
            <View
              style={[
                styles.authorIndicator,
                { backgroundColor: formatted.color }
              ]}
            />
            <SSText size="sm" color="muted">
              {formatted.text}
              {isDeviceMessage &&
                t('account.nostrSync.devicesGroupChat.youSuffix')}
            </SSText>
          </SSHStack>
          <SSText size="xs" color="muted">
            {new Date(msg.created_at * 1000).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </SSText>
        </SSHStack>
        {hasSignFlow && transactionData ? (
          <SSTransactionDetails
            transactionData={transactionData}
            account={account}
            visibility={visibility}
            onToggleVisibility={(component) =>
              onToggleVisibility(msg.id, component)
            }
            onGoToSignFlow={() => onGoToSignFlow(messageContent)}
          />
        ) : (
          <SSText size="md">{messageContent}</SSText>
        )}
      </SSVStack>
    )
  } catch {
    return (
      <SSVStack gap="xxs" style={styles.message}>
        <SSText size="sm" color="muted">
          {t('account.nostrSync.devicesGroupChat.displayError')}
        </SSText>
      </SSVStack>
    )
  }
}

const styles = StyleSheet.create({
  message: {
    backgroundColor: '#1a1a1a',
    padding: 10,
    paddingBottom: 15,
    paddingTop: 5,
    borderRadius: 8,
    marginTop: 8
  },
  deviceMessage: {
    backgroundColor: '#2a2a2a'
  },
  authorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 1,
    marginRight: 3
  }
})

export default SSNostrMessage
