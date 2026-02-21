import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSTransactionDetails from '@/components/SSTransactionDetails'
import { useNostrMessage } from '@/hooks/useNostrMessage'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type NostrDM } from '@/types/models/Nostr'

type SSNostrMessageProps = {
  item: NostrDM
  account: Account | undefined
  accounts: Account[]
  formattedNpubs: Map<string, { text: string; color: string }>
  visibleComponents: Map<string, { sankey: boolean; status: boolean }>
  onToggleVisibility: (msgId: string, component: 'sankey' | 'status') => void
  onGoToSignFlow: (messageContent: string) => void
}

function SSNostrMessage({
  item: msg,
  account,
  accounts,
  formattedNpubs,
  visibleComponents,
  onToggleVisibility,
  onGoToSignFlow
}: SSNostrMessageProps) {
  const {
    isDeviceMessage,
    authorDisplayName,
    messageContent,
    transactionData,
    hasSignFlow,
    formattedDate,
    error
  } = useNostrMessage({ msg, account, formattedNpubs })

  const visibility = visibleComponents.get(msg.id) || {
    sankey: false,
    status: false
  }

  if (error) {
    return (
      <SSVStack gap="xxs" style={styles.message}>
        <SSText size="sm" color="muted">
          {t('account.nostrSync.devicesGroupChat.displayError')}
        </SSText>
      </SSVStack>
    )
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
              { backgroundColor: authorDisplayName.color }
            ]}
          />
          <SSText size="sm" color="muted">
            {authorDisplayName.text}
            {isDeviceMessage &&
              t('account.nostrSync.devicesGroupChat.youSuffix')}
          </SSText>
        </SSHStack>
        <SSHStack gap="xs" style={{ alignItems: 'center' }}>
          <SSText size="xs" color="muted">
            {formattedDate}
          </SSText>
          {msg.pending && (
            <SSText size="xs" color="muted">
              ({t('account.nostrSync.devicesGroupChat.sending')})
            </SSText>
          )}
        </SSHStack>
      </SSHStack>
      {hasSignFlow && transactionData ? (
        <SSTransactionDetails
          transactionData={transactionData}
          account={account}
          accounts={accounts}
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
