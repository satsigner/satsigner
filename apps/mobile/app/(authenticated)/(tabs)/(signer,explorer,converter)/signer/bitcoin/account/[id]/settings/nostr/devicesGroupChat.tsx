import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo
} from '@shopify/flash-list'
import {
  Redirect,
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams
} from 'expo-router'
import { useHeaderHeight } from 'expo-router/react-navigation'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSNostrMessage from '@/components/SSNostrMessage'
import SSText from '@/components/SSText'
import SSTransactionDetails from '@/components/SSTransactionDetails'
import {
  NOSTR_GROUP_CHAT_AUTOSCROLL_THRESHOLD,
  NOSTR_GROUP_CHAT_MESSAGE_MAX_LENGTH,
  NOSTR_GROUP_CHAT_PAGE_SIZE,
  NOSTR_GROUP_CHAT_SCROLL_THRESHOLD
} from '@/constants/nostr'
import { useAccountKeyFingerprints } from '@/hooks/useAccountKeyFingerprints'
import { useNostrDeviceChatProfilesFetch } from '@/hooks/useNostrDeviceChatProfilesFetch'
import { type AuthorDisplayInfo } from '@/hooks/useNostrMessage'
import { setActiveChatAccount } from '@/hooks/useNostrNotifyUtils'
import useNostrPublish from '@/hooks/useNostrPublish'
import { useNostrSignFlow } from '@/hooks/useNostrSignFlow'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { Colors } from '@/styles'
import { type Account } from '@/types/models/Account'
import { type NostrDM } from '@/types/models/Nostr'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { parseNostrTransaction } from '@/utils/nostr'
import {
  buildAuthorDisplayMap,
  getAuthorsMissingProfiles
} from '@/utils/nostrAuthorDisplay'
import {
  type DeviceChatSendOutcome,
  retryDeviceChatMessage,
  sendDeviceChatMessage
} from '@/utils/nostrDeviceChat'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'
import {
  type KeyFingerprintsByAccount,
  type TransactionData
} from '@/utils/psbt'

type VisibleComponents = Map<string, { sankey: boolean; status: boolean }>

type GroupChatRowContextValue = {
  account: Account
  accounts: Account[]
  failedSends: Record<string, string[]>
  formattedNpubs: Map<string, AuthorDisplayInfo>
  keyFingerprintsByAccount: KeyFingerprintsByAccount
  onAuthorPress: (npub: string) => void
  onGoToSignFlow: (messageContent: string) => void
  onOpenLinkedTx: (accountId: string, txId: string) => void
  onRetry: (messageId: string) => void
  onToggleVisibility: (msgId: string, component: 'sankey' | 'status') => void
  visibleComponents: VisibleComponents
}

const GroupChatRowContext = createContext<GroupChatRowContextValue | null>(null)

const EMPTY_MEMBERS: { npub: string; color: string }[] = []
const EMPTY_DMS: NostrDM[] = []

function GroupChatRow({ item }: { item: NostrDM }) {
  const context = use(GroupChatRowContext)
  if (!context) {
    return null
  }
  return (
    <SSNostrMessage
      item={item}
      account={context.account}
      accounts={context.accounts}
      keyFingerprintsByAccount={context.keyFingerprintsByAccount}
      formattedNpubs={context.formattedNpubs}
      visibleComponents={context.visibleComponents}
      onToggleVisibility={context.onToggleVisibility}
      onGoToSignFlow={context.onGoToSignFlow}
      onAuthorPress={context.onAuthorPress}
      onOpenLinkedTx={context.onOpenLinkedTx}
      failed={(context.failedSends[item.id]?.length ?? 0) > 0}
      onRetry={context.onRetry}
    />
  )
}

function renderGroupChatRow({ item }: ListRenderItemInfo<NostrDM>) {
  return <GroupChatRow item={item} />
}

function getMessageKey(item: NostrDM) {
  return item.id
}

function isScrolledToBottom({
  contentOffset,
  contentSize,
  layoutMeasurement
}: NativeScrollEvent): boolean {
  return (
    contentOffset.y + layoutMeasurement.height >=
    contentSize.height - NOSTR_GROUP_CHAT_SCROLL_THRESHOLD
  )
}

function withoutKey(record: Record<string, string[]>, key: string) {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key))
}

export default function DevicesGroupChat() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const headerHeight = useHeaderHeight()
  const listRef = useRef<FlashListRef<NostrDM>>(null)
  const { sendPSBT } = useNostrPublish()
  const { handleGoToSignFlow } = useNostrSignFlow()

  const account = useAccountsStore((state) =>
    state.accounts.find((acc) => acc.id === accountId)
  )
  const markDmsAsRead = useAccountsStore((state) => state.markDmsAsRead)
  // The group chat belongs to this account; its PSBTs are matched against it.
  const chatAccounts = account ? [account] : []
  const { data: keyFingerprintsByAccount = {} } =
    useAccountKeyFingerprints(chatAccounts)

  useFocusEffect(
    useCallback(() => {
      if (accountId) {
        setActiveChatAccount(accountId)
        markDmsAsRead(accountId)
      }
      return () => {
        setActiveChatAccount(null)
      }
    }, [accountId, markDmsAsRead])
  )

  const members =
    useNostrStore((state) =>
      accountId ? state.members?.[accountId] : undefined
    ) ?? EMPTY_MEMBERS
  const storeProfiles = useNostrStore((state) => state.profiles)
  const syncStatus = useNostrStore((state) =>
    accountId ? state.syncStatus[accountId]?.status : undefined
  )
  const isAccountSyncing = useNostrStore((state) =>
    accountId ? (state.syncingAccounts[accountId] ?? false) : false
  )
  const transactionToShare = useNostrStore((state) => state.transactionToShare)
  const setTransactionToShare = useNostrStore(
    (state) => state.setTransactionToShare
  )

  const [isLoading, setIsLoading] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [visibleComponents, setVisibleComponents] = useState<VisibleComponents>(
    new Map()
  )
  const [failedSends, setFailedSends] = useState<Record<string, string[]>>({})
  const [isShareModalVisible, setIsShareModalVisible] = useState(false)
  const [transactionToShareLocal, setTransactionToShareLocal] = useState('')
  const [transactionDataForModal, setTransactionDataForModal] =
    useState<TransactionData | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [seenNewestId, setSeenNewestId] = useState<string>()
  const [displayCount, setDisplayCount] = useState(NOSTR_GROUP_CHAT_PAGE_SIZE)

  const messages = account?.nostr?.dms ?? EMPTY_DMS
  const displayedMessages = messages.slice(-displayCount)
  const newestId = messages.at(-1)?.id
  const showNewMessageButton =
    !isAtBottom && seenNewestId !== undefined && newestId !== seenNewestId
  const isSyncInProgress = syncStatus === 'connecting' || isAccountSyncing

  const authorInput = account?.nostr
    ? {
        dms: messages,
        members,
        nostr: account.nostr,
        profiles: storeProfiles
      }
    : null
  const missingAuthors = authorInput
    ? getAuthorsMissingProfiles(authorInput)
    : []
  const { data: fetchedProfiles } = useNostrDeviceChatProfilesFetch(
    account?.nostr?.relays ?? [],
    missingAuthors
  )
  const formattedNpubs = authorInput
    ? buildAuthorDisplayMap({
        ...authorInput,
        profiles: { ...storeProfiles, ...fetchedProfiles }
      })
    : new Map<string, AuthorDisplayInfo>()

  function recordSendOutcome(outcome: DeviceChatSendOutcome | null) {
    if (!outcome) {
      return
    }
    const { error, failedDevices, messageId } = outcome
    setFailedSends((prev) =>
      failedDevices.length > 0
        ? { ...prev, [messageId]: failedDevices }
        : withoutKey(prev, messageId)
    )
    if (failedDevices.length > 0) {
      toast.error(t('common.error.failedToSendMessage'), {
        description: getNostrErrorMessage(error)
      })
    }
  }

  async function handleSendMessage() {
    const trimmed = messageInput.trim()
    if (!trimmed) {
      toast.error(t('common.error.messageCannotBeEmpty'))
      return
    }
    if (!account?.nostr?.autoSync) {
      toast.error(t('common.error.autoSyncMustBeEnabled'))
      return
    }
    if (
      !accountId ||
      !account.nostr.deviceNsec ||
      !account.nostr.deviceNpub ||
      !account.nostr.relays?.length
    ) {
      toast.error(t('common.error.missingRequiredNostrConfig'))
      return
    }

    setMessageInput('')
    setIsLoading(true)
    try {
      recordSendOutcome(await sendDeviceChatMessage(accountId, trimmed))
      listRef.current?.scrollToEnd({ animated: true })
    } catch (error) {
      toast.error(t('common.error.failedToSendMessage'), {
        description: getNostrErrorMessage(error)
      })
      setMessageInput(trimmed)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRetry(messageId: string) {
    const message = messages.find((dm) => dm.id === messageId)
    const failedDevices = failedSends[messageId]
    if (!accountId || !message || !failedDevices) {
      return
    }
    try {
      recordSendOutcome(
        await retryDeviceChatMessage(accountId, message, failedDevices)
      )
    } catch (error) {
      toast.error(t('common.error.failedToSendMessage'), {
        description: getNostrErrorMessage(error)
      })
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
      const next = new Map(prev)
      const current = next.get(msgId) || { sankey: false, status: false }
      next.set(msgId, { ...current, [component]: true })
      return next
    })
  }

  function handleAuthorPress(npub: string) {
    router.push({
      params: { id: accountId, npub },
      pathname: '/signer/bitcoin/account/[id]/settings/nostr/device/[npub]'
    })
  }

  function handleOpenLinkedTx(matchedAccountId: string, linkedTxId: string) {
    router.push(
      `/signer/bitcoin/account/${matchedAccountId}/transaction/${linkedTxId}`
    )
  }

  async function handleShareInChat() {
    if (!account || !transactionToShareLocal) {
      return
    }
    setIsLoading(true)
    try {
      await sendPSBT(account, transactionToShareLocal)
      toast.success(t('account.nostrSync.transactionDataSentToGroupChat'))
    } catch (error) {
      toast.error(t('account.nostrSync.failedToSendTransactionData'), {
        description: getNostrErrorMessage(error)
      })
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

  function handleScrollToBottom() {
    listRef.current?.scrollToEnd({ animated: true })
    setIsAtBottom(true)
  }

  function handleListScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const atBottom = isScrolledToBottom(event.nativeEvent)
    if (atBottom === isAtBottom) {
      return
    }
    setIsAtBottom(atBottom)
    if (!atBottom) {
      setSeenNewestId(newestId)
    }
  }

  function handleLoadOlder() {
    if (displayCount >= messages.length) {
      return
    }
    setDisplayCount((count) =>
      Math.min(count + NOSTR_GROUP_CHAT_PAGE_SIZE, messages.length)
    )
  }

  useEffect(() => {
    if (transactionToShare) {
      setTransactionToShareLocal(transactionToShare.transaction)
      setTransactionDataForModal(transactionToShare.transactionData)
      setIsShareModalVisible(true)
      setTransactionToShare(null)
    }
  }, [transactionToShare, setTransactionToShare])

  if (!accountId || !account) {
    return <Redirect href="/" />
  }

  const rowContext: GroupChatRowContextValue = {
    account,
    accounts: chatAccounts,
    failedSends,
    formattedNpubs,
    keyFingerprintsByAccount,
    onAuthorPress: handleAuthorPress,
    onGoToSignFlow: handleGoToSignFlowClick,
    onOpenLinkedTx: handleOpenLinkedTx,
    onRetry: handleRetry,
    onToggleVisibility: handleToggleVisibility,
    visibleComponents
  }

  const emptyText = isSyncInProgress
    ? t('account.nostrSync.devicesGroupChat.loadingMessages')
    : t('account.nostrSync.devicesGroupChat.noMessages')

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerRight: () => null,
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
            </SSHStack>
          )
        }}
      />
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
        style={styles.keyboardAvoiding}
      >
        <SSVStack gap="sm" style={styles.chatContent}>
          <SSText center uppercase color="muted">
            {t('account.nostrSync.devicesGroupChat.title')}
            {account.nostr.autoSync
              ? t('account.nostrSync.devicesGroupChat.syncOn')
              : t('account.nostrSync.devicesGroupChat.syncOff')}
          </SSText>

          <View style={styles.messagesContainer}>
            {messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <SSText center color="muted">
                  {emptyText}
                </SSText>
              </View>
            ) : (
              <GroupChatRowContext
                // oxlint-disable-next-line react/jsx-no-constructed-context-values -- React Compiler memoizes rowContext on its inputs
                value={rowContext}
              >
                <FlashList
                  ref={listRef}
                  data={displayedMessages}
                  renderItem={renderGroupChatRow}
                  keyExtractor={getMessageKey}
                  extraData={rowContext}
                  maintainVisibleContentPosition={{
                    autoscrollToBottomThreshold:
                      NOSTR_GROUP_CHAT_AUTOSCROLL_THRESHOLD,
                    startRenderingFromBottom: true
                  }}
                  onStartReached={handleLoadOlder}
                  onScroll={handleListScroll}
                  scrollEventThrottle={16}
                />
              </GroupChatRowContext>
            )}
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
              placeholderTextColor={Colors.gray[500]}
              multiline
              maxLength={NOSTR_GROUP_CHAT_MESSAGE_MAX_LENGTH}
            />
            <SSButton
              style={styles.sendButton}
              label={t('account.nostrSync.devicesGroupChat.sendButton')}
              onPress={handleSendMessage}
              disabled={isLoading || !messageInput.trim()}
            />
          </SSHStack>
        </SSVStack>
      </KeyboardAvoidingView>
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
                  accounts={chatAccounts}
                  keyFingerprintsByAccount={keyFingerprintsByAccount}
                />
              ) : (
                <SSText style={styles.modalMessageText}>
                  {transactionToShareLocal}
                </SSText>
              )}
            </ScrollView>
            <SSVStack gap="xs" style={styles.modalActions}>
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
  chatContent: {
    flex: 1
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  input: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    color: Colors.white,
    flex: 0.8,
    minHeight: 60,
    padding: 10,
    textAlignVertical: 'top'
  },
  inputContainer: {
    paddingBottom: 16,
    paddingHorizontal: 0
  },
  keyboardAvoiding: {
    flex: 1
  },
  messagesContainer: {
    flex: 1,
    paddingBottom: 8
  },
  modalActions: {
    marginTop: 2
  },
  modalContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    width: '100%'
  },
  modalContent: {
    backgroundColor: Colors.gray[900],
    justifyContent: 'space-between',
    maxHeight: '85%',
    minHeight: '60%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: '100%'
  },
  modalMessageText: {
    maxHeight: 300
  },
  modalScroll: {
    width: '100%'
  },
  modalScrollContent: {
    paddingBottom: 4
  },
  newMessageButtonContainer: {
    alignSelf: 'center',
    bottom: 70,
    position: 'absolute',
    zIndex: 2
  },
  sendButton: {
    flex: 0.2
  }
})
