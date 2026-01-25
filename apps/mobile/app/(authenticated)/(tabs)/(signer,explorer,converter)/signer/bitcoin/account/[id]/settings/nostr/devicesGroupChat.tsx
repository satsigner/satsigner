import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSNostrMessage from '@/components/SSNostrMessage'
import SSText from '@/components/SSText'
import SSTransactionDetails from '@/components/SSTransactionDetails'
import { useNostrPublish } from '@/hooks/useNostrPublish'
import { useNostrSignFlow } from '@/hooks/useNostrSignFlow'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { parseNostrTransaction } from '@/utils/nostr'
import { type TransactionData } from '@/utils/psbt'

const colorCache = new Map<string, { text: string; color: string }>()

async function formatNpub(
  pubkey: string,
  members: { npub: string; color: string }[]
) {
  if (!pubkey)
    return {
      text: t('account.nostrSync.devicesGroupChat.unknownSender'),
      color: '#666666'
    }

  const cached = colorCache.get(pubkey)
  if (cached) {
    return cached
  }

  try {
    const npub = nip19.npubEncode(pubkey)
    const member = members.find((m) => m.npub === npub)

    const color = member?.color || '#404040'
    const result = {
      text: `${npub.slice(0, 12)}...${npub.slice(-4)}`,
      color
    }
    colorCache.set(pubkey, result)
    return result
  } catch {
    return {
      text: pubkey.slice(0, 8),
      color: '#404040'
    }
  }
}

export default function DevicesGroupChat() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const flatListRef = useRef<FlatList>(null)
  const formattedAuthorsRef = useRef(new Set<string>())
  const { sendDM, sendPSBT } = useNostrPublish()
  const { handleGoToSignFlow } = useNostrSignFlow()

  const [accounts, account] = useAccountsStore(
    useShallow((state) => [
      state.accounts,
      state.accounts.find((acc) => acc.id === accountId)
    ])
  )

  const members = useNostrStore(
    (state) => (accountId && state.members?.[accountId]) || []
  )
  const [transactionToShare, setTransactionToShare] = useNostrStore(
    useShallow((state) => [
      state.transactionToShare,
      state.setTransactionToShare
    ])
  )

  const [isLoading, setIsLoading] = useState(false)
  const [isContentLoaded, setIsContentLoaded] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [messageInput, setMessageInput] = useState('')
  const [formattedNpubs, setFormattedNpubs] = useState<
    Map<string, { text: string; color: string }>
  >(new Map())
  const [visibleComponents, setVisibleComponents] = useState(
    new Map<string, { sankey: boolean; status: boolean }>()
  )
  const [isShareModalVisible, setIsShareModalVisible] = useState(false)
  const [transactionToShareLocal, setTransactionToShareLocal] = useState('')
  const [transactionDataForModal, setTransactionDataForModal] =
    useState<TransactionData | null>(null)
  const isAtBottomRef = useRef(true)
  const [showNewMessageButton, setShowNewMessageButton] = useState(false)

  const messages = useMemo(
    () => account?.nostr?.dms || [],
    [account?.nostr?.dms]
  )

  const prevMessageCountRef = useRef(messages.length)

  const memoizedMessages = useMemo(() => messages, [messages])

  const membersList = useMemo(
    () =>
      members.map((member: { npub: string; color?: string }) => ({
        npub: member.npub,
        color: member.color || '#404040'
      })),
    [members]
  )

  async function handleSendMessage() {
    if (!messageInput.trim()) {
      toast.error(t('common.error.messageCannotBeEmpty'))
      return
    }

    if (!account?.nostr?.autoSync) {
      toast.error(t('common.error.autoSyncMustBeEnabled'))
      return
    }

    if (
      !account?.nostr?.deviceNsec ||
      !account?.nostr?.deviceNpub ||
      !account?.nostr?.relays?.length
    ) {
      toast.error(t('common.error.missingRequiredNostrConfig'))
      return
    }

    setIsLoading(true)
    try {
      await sendDM(account, messageInput.trim())
      setMessageInput('')
    } catch {
      toast.error(t('common.error.failedToSendMessage'))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoToSignFlowClick(messageContent: string) {
    try {
      const transactionData = parseNostrTransaction(messageContent)
      if (!transactionData) {
        toast.error(t('common.error.transactionDataParseFailed'))
        return
      }

      await handleGoToSignFlow(transactionData)
    } catch {
      toast.error(t('common.error.openSignFlowFailed'))
    }
  }

  function handleToggleVisibility(
    msgId: string,
    component: 'sankey' | 'status'
  ) {
    setVisibleComponents((prev) => {
      const newMap = new Map(prev)
      const current = newMap.get(msgId) || {
        sankey: false,
        status: false
      }
      newMap.set(msgId, { ...current, [component]: true })
      return newMap
    })
  }

  async function handleShareInChat() {
    if (!account || !transactionToShareLocal) return

    setIsLoading(true)
    try {
      await sendPSBT(account, transactionToShareLocal)
      toast.success(t('account.nostrSync.transactionDataSentToGroupChat'))
    } catch {
      toast.error(t('account.nostrSync.failedToSendTransactionData'))
    } finally {
      setIsShareModalVisible(false)
      setTransactionToShareLocal('')
      setTransactionDataForModal(null)
      setIsLoading(false)
    }
  }

  function handleCancelShare() {
    setIsShareModalVisible(false)
    setTransactionToShareLocal('')
    setTransactionDataForModal(null)
  }

  useEffect(() => {
    async function formatNpubs() {
      const newFormattedNpubs = new Map()
      let hasNewAuthors = false

      for (const msg of memoizedMessages) {
        if (!formattedAuthorsRef.current.has(msg.author)) {
          const formatted = await formatNpub(msg.author, membersList)
          newFormattedNpubs.set(msg.author, formatted)
          formattedAuthorsRef.current.add(msg.author)
          hasNewAuthors = true
        }
      }

      if (hasNewAuthors) {
        setFormattedNpubs((prev) => new Map([...prev, ...newFormattedNpubs]))
      }
    }

    formatNpubs()
  }, [memoizedMessages, membersList])

  useEffect(() => {
    if (messages.length > 0 && account?.nostr?.relays?.length) {
      if (isInitialLoad) {
        setIsContentLoaded(false)
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: false })
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: false })
              setIsContentLoaded(true)
              setIsInitialLoad(false)
              isAtBottomRef.current = true
            }, 200)
          }
        }, 100)
      } else if (isAtBottomRef.current && flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: false })
      }
    }
  }, [messages.length, account?.nostr?.relays?.length, isInitialLoad])

  useEffect(() => {
    const prevCount = prevMessageCountRef.current
    if (messages.length > prevCount && !isAtBottomRef.current) {
      setShowNewMessageButton(true)
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length])

  function handleScrollToBottom() {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true })
      isAtBottomRef.current = true
      setShowNewMessageButton(false)
    }
  }

  function handleListScroll(e: {
    nativeEvent: {
      contentOffset: { y: number }
      layoutMeasurement: { height: number }
      contentSize: { height: number }
    }
  }) {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent
    const threshold = 40
    const atBottom =
      contentOffset.y + layoutMeasurement.height >=
      contentSize.height - threshold
    if (isAtBottomRef.current !== atBottom) {
      isAtBottomRef.current = atBottom
      if (atBottom) setShowNewMessageButton(false)
    }
  }

  useEffect(() => {
    if (transactionToShare) {
      setTransactionToShareLocal(transactionToShare.transaction)
      setTransactionDataForModal(transactionToShare.transactionData)
      setIsShareModalVisible(true)
      setTransactionToShare(null)
    }
  }, [transactionToShare, setTransactionToShare])

  if (!accountId || !account) return <Redirect href="/" />

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
            </SSHStack>
          ),
          headerRight: () => null
        }}
      />
      <SSVStack gap="sm" style={{ flex: 1 }}>
        <SSVStack gap="sm">
          <SSVStack gap="xs">
            <SSText center uppercase color="muted">
              {t('account.nostrSync.devicesGroupChat.title')}
              {account.nostr.autoSync
                ? t('account.nostrSync.devicesGroupChat.syncOn')
                : t('account.nostrSync.devicesGroupChat.syncOff')}
            </SSText>
          </SSVStack>
        </SSVStack>

        <View style={styles.messagesContainer}>
          {!isContentLoaded && isInitialLoad && messages.length > 0 && (
            <View style={styles.loadingContainer}>
              <SSText center color="muted">
                {t('account.nostrSync.devicesGroupChat.loadingMessages')}
              </SSText>
            </View>
          )}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={({ item }) => (
              <SSNostrMessage
                item={item}
                account={account}
                accounts={accounts}
                formattedNpubs={formattedNpubs}
                visibleComponents={visibleComponents}
                onToggleVisibility={handleToggleVisibility}
                onGoToSignFlow={handleGoToSignFlowClick}
              />
            )}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <SSText center color="muted">
                {t('account.nostrSync.devicesGroupChat.noMessages')}
              </SSText>
            }
            inverted={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
            onContentSizeChange={() => {
              if (isAtBottomRef.current && flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: false })
              }
            }}
            onLayout={() => {
              if (isAtBottomRef.current && flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: false })
              }
            }}
            onScroll={handleListScroll}
            scrollEventThrottle={16}
          />
          {showNewMessageButton && (
            <View style={styles.newMessageButtonContainer}>
              <SSButton
                label={t('account.nostrSync.devicesGroupChat.newMessages')}
                onPress={handleScrollToBottom}
                variant="secondary"
              />
            </View>
          )}
        </View>
        <SSHStack gap="sm" style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={messageInput}
            onChangeText={setMessageInput}
            placeholder={t(
              'account.nostrSync.devicesGroupChat.messagePlaceholder'
            )}
            placeholderTextColor={Colors.white}
            multiline
            maxLength={500}
          />
          <SSButton
            style={styles.sendButton}
            label={t('account.nostrSync.devicesGroupChat.sendButton')}
            onPress={handleSendMessage}
            disabled={isLoading || !messageInput.trim()}
          />
        </SSHStack>
      </SSVStack>
      <SSModal
        visible={isShareModalVisible}
        onClose={handleCancelShare}
        label=""
      >
        <View style={styles.modalContainer}>
          <SSVStack gap="xs" style={styles.modalContent}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {transactionDataForModal ? (
                <SSTransactionDetails
                  transactionData={transactionDataForModal}
                  account={account}
                  accounts={accounts}
                />
              ) : (
                <SSText style={styles.modalMessageText}>
                  {transactionToShareLocal}
                </SSText>
              )}
            </ScrollView>
            <SSVStack gap="xs" style={{ marginTop: 2 }}>
              <SSButton
                label={t('account.nostrSync.shareInChat')}
                onPress={handleShareInChat}
                loading={isLoading}
              />
              <SSButton
                label={t('common.cancel')}
                onPress={handleCancelShare}
                variant="ghost"
              />
            </SSVStack>
          </SSVStack>
        </View>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  messagesContainer: {
    flex: 1,
    paddingBottom: 8
  },
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
  },
  inputContainer: {
    paddingHorizontal: 0
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: Colors.white,
    padding: 10,
    borderRadius: 8,
    minHeight: 60,
    textAlignVertical: 'top',
    flex: 0.8
  },
  sendButton: {
    flex: 0.2
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1
  },
  signFlowButton: {
    marginTop: 8,
    alignSelf: 'flex-start'
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'transparent'
  },
  modalContent: {
    backgroundColor: Colors.gray[900],
    paddingVertical: 6,
    paddingHorizontal: 12,
    width: '100%',
    minHeight: '60%',
    maxHeight: '85%',
    justifyContent: 'space-between'
  },
  modalScroll: {
    width: '100%'
  },
  modalScrollContent: {
    paddingBottom: 4
  },
  modalMessageText: {
    maxHeight: 300
  },
  newMessageButtonContainer: {
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
    zIndex: 2
  }
})
