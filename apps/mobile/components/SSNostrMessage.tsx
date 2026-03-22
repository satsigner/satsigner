import { router } from 'expo-router'
import { Image, Pressable, StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSTransactionDetails from '@/components/SSTransactionDetails'
import { useNostrMessage } from '@/hooks/useNostrMessage';
import type { AuthorDisplayInfo } from '@/hooks/useNostrMessage';
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { Account } from '@/types/models/Account'
import type { NostrDM } from '@/types/models/Nostr'

interface SSNostrMessageProps {
  item: NostrDM
  account: Account | undefined
  accounts: Account[]
  formattedNpubs: Map<string, AuthorDisplayInfo>
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
    authorNpub,
    isDeviceMessage,
    authorDisplayName,
    messageContent,
    transactionData,
    hasSignFlow,
    formattedDate,
    error
  } = useNostrMessage({ account, formattedNpubs, msg })

  function handleAuthorPress() {
    if (!account?.id || !authorNpub) {return}
    router.push({
      params: { npub: authorNpub },
      pathname: `/signer/bitcoin/account/${account.id}/settings/nostr/device/[npub]`
    })
  }

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
        <Pressable
          onPress={handleAuthorPress}
          style={({ pressed }) => [
            styles.authorPressable,
            pressed && styles.authorPressablePressed
          ]}
        >
          <SSHStack gap="xxs" style={{ alignItems: 'center' }}>
            {authorDisplayName.picture ? (
              <Image
                source={{ uri: authorDisplayName.picture }}
                style={styles.authorAvatar}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.authorIndicatorLarge,
                  { backgroundColor: authorDisplayName.color }
                ]}
              />
            )}
            <SSVStack gap="xxs" style={styles.authorBlock}>
              <SSHStack gap="xxs" style={{ alignItems: 'center' }}>
                {authorDisplayName.displayName ? (
                  <>
                    <SSText size="sm" style={styles.authorName}>
                      {authorDisplayName.displayName}
                    </SSText>
                    {authorDisplayName.alias ? (
                      <SSText size="sm" color="muted">
                        ({authorDisplayName.alias})
                      </SSText>
                    ) : null}
                  </>
                ) : (authorDisplayName.alias ? (
                  <SSText size="sm" style={styles.authorName}>
                    {authorDisplayName.alias}
                  </SSText>
                ) : (
                  <SSText size="sm" color="muted">
                    {authorDisplayName.npubShort}
                  </SSText>
                ))}
                {isDeviceMessage && (
                  <SSText size="sm" color="muted">
                    {t('account.nostrSync.devicesGroupChat.youSuffix')}
                  </SSText>
                )}
              </SSHStack>
              {(authorDisplayName.displayName || authorDisplayName.alias) && (
                <SSHStack
                  gap="xxs"
                  style={[styles.npubRow, { alignItems: 'center' }]}
                >
                  {authorDisplayName.picture ? (
                    <View
                      style={[
                        styles.authorIndicatorSmall,
                        { backgroundColor: authorDisplayName.color }
                      ]}
                    />
                  ) : null}
                  <SSText size="xs" color="muted">
                    {authorDisplayName.npubShort}
                  </SSText>
                </SSHStack>
              )}
            </SSVStack>
          </SSHStack>
        </Pressable>
        <SSHStack
          gap="xs"
          style={{
            alignItems: 'flex-start',
            alignSelf: 'flex-start',
            marginTop: -2
          }}
        >
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
      <View style={styles.messageContentWrap}>
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
      </View>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6
  },
  authorBlock: {
    gap: 0
  },
  authorIndicatorLarge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6
  },
  authorIndicatorSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 3
  },
  authorName: {
    color: Colors.white
  },
  authorPressable: {
    alignSelf: 'flex-start'
  },
  authorPressablePressed: {
    opacity: 0.7
  },
  deviceMessage: {
    backgroundColor: Colors.gray[800]
  },
  message: {
    backgroundColor: Colors.gray[900],
    padding: 10,
    paddingBottom: 15,
    paddingTop: 5,
    borderRadius: 8,
    marginTop: 8
  },
  messageContentWrap: {
    paddingLeft: 30
  },
  npubRow: {
    marginTop: -4
  }
})

export default SSNostrMessage
