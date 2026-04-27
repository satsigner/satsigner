import {
  Redirect,
  Stack,
  useFocusEffect,
  useLocalSearchParams
} from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSNostrMessage from '@/components/SSNostrMessage'
import SSText from '@/components/SSText'
import SSTransactionDetails from '@/components/SSTransactionDetails'
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
import { type NostrDM } from '@/types/models/Nostr'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { parseNostrTransaction } from '@/utils/nostr'
import { type TransactionData } from '@/utils/psbt'

// In-memory color cache; keyed by pubkey hex.
// Display text is NOT cached here — it's recomputed whenever profiles update.
const colorCache = new Map<string, string>()

const EMPTY_MEMBERS: { npub: string; color: string }[] = []

function getAuthorColor(
  pubkey: string,
  members: { npub: string; color: string }[]
): string {
  const cached = colorCache.get(pubkey)
  if (cached) {
    return cached
  }

  try {
    const npub = nip19.npubEncode(pubkey)
    const member = members.find((m) => m.npub === npub)
    const color = member?.color || Colors.gray[500]
    colorCache.set(pubkey, color)
    return color
  } catch {
    return Colors.gray[500]
  }
}

function formatNpubText(pubkey: string): string {
  try {
    const npub = nip19.npubEncode(pubkey)
    return `${npub.slice(0, 12)}...${npub.slice(-4)}`
  } catch {
    return pubkey.slice(0, 8)
  }
}

const INITIAL_PAGE_SIZE = 50
const PAGE_SIZE = 50
const SCROLL_THRESHOLD = 40

export default function DevicesGroupChat() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const flatListRef = useRef<FlatList>(null)
  const { sendDM, sendPSBT } = useNostrPublish()
  const { handleGoToSignFlow } = useNostrSignFlow()

  const [accounts, account, updateAccountNostr, markDmsAsRead] =
    useAccountsStore(
      useShallow((state) => [
        state.accounts,
        state.accounts.find((acc) => acc.id === accountId),
        state.updateAccountNostr,
        state.markDmsAsRead
      ])
    )

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

  const accountMembers = useNostrStore((state) =>
    accountId ? state.members?.[accountId] : undefined
  )
  const members = accountMembers || EMPTY_MEMBERS
  const [profiles, setProfile] = useNostrStore(
    useShallow((state) => [state.profiles, state.setProfile])
  )
  const [transactionToShare, setTransactionToShare] = useNostrStore(
    useShallow((state) => [
      state.transactionToShare,
      state.setTransactionToShare
    ])
  )

  const [isLoading, setIsLoading] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [formattedNpubs, setFormattedNpubs] = useState<
    Map<string, AuthorDisplayInfo>
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
  const [displayCount, setDisplayCount] = useState(INITIAL_PAGE_SIZE)
  const lastLoadMoreAtRef = useRef(0)

  const messages = useMemo(
    () => account?.nostr?.dms || [],
    [account?.nostr?.dms]
  )

  const displayedMessages = useMemo(
    () => messages.slice(-displayCount).reverse(),
    [messages, displayCount]
  )

  const prevMessageCountRef = useRef(messages.length)

  const memoizedMessages = messages

  const membersList = useMemo(
    () =>
      members.map((member: { npub: string; color?: string }) => ({
        color: member.color || Colors.gray[500],
        npub: member.npub
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

    const trimmed = messageInput.trim()
    let pendingId: string | null = null
    try {
      const decoded = nip19.decode(account.nostr.deviceNpub)
      const devicePubkeyHex =
        decoded?.type === 'npub' && typeof decoded.data === 'string'
          ? decoded.data
          : null
      if (!devicePubkeyHex) {
        toast.error(t('common.error.missingRequiredNostrConfig'))
        return
      }
      const created_at = Math.floor(Date.now() / 1000)
      pendingId = `pending-${Date.now()}`
      const optimisticMessage: NostrDM = {
        author: devicePubkeyHex,
        content: {
          created_at,
          description: trimmed,
          pubkey: devicePubkeyHex
        },
        created_at,
        description: trimmed,
        event: '',
        id: pendingId,
        label: 1,
        pending: true
      }
      updateAccountNostr(accountId!, {
        dms: [...(account.nostr?.dms ?? []), optimisticMessage].toSorted(
          (a, b) => a.created_at - b.created_at
        )
      })
      setMessageInput('')
    } catch {
      toast.error(t('common.error.failedToSendMessage'))
      return
    }

    setIsLoading(true)
    try {
      await sendDM(account, trimmed)
      // Mark as sent: many relays don't echo events back to the sender, so we
      // clear pending when publish succeeds instead of waiting for the echo.
      if (pendingId && accountId) {
        const current = useAccountsStore
          .getState()
          .accounts.find((a) => a.id === accountId)
        const dms = (current?.nostr?.dms ?? []).map((m) =>
          m.id === pendingId ? { ...m, pending: false } : m
        )
        updateAccountNostr(accountId, { dms })
      }
    } catch {
      toast.error(t('common.error.failedToSendMessage'))
      if (pendingId && accountId) {
        const current = useAccountsStore
          .getState()
          .accounts.find((a) => a.id === accountId)
        const dms = (current?.nostr?.dms ?? []).filter(
          (m) => m.id !== pendingId
        )
        updateAccountNostr(accountId, { dms })
      }
      setMessageInput(trimmed)
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
    if (!account || !transactionToShareLocal) {
      return
    }

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

  // Rebuild formatted display names whenever messages, members, profiles, or aliases change.
  // We intentionally do NOT cache these by author in a ref because profiles can
  // arrive after the initial render and we need to re-compute the display text.
  useEffect(() => {
    const newFormattedNpubs = new Map<string, AuthorDisplayInfo>()
    const aliases = account?.nostr?.npubAliases ?? {}

    for (const msg of memoizedMessages) {
      if (!msg.author) {
        continue
      }
      const color = getAuthorColor(msg.author, membersList)
      let npub: string
      try {
        npub = nip19.npubEncode(msg.author)
      } catch {
        npub = ''
      }
      const profile = npub ? profiles[npub] : undefined
      const accountProfile = npub
        ? account?.nostr?.npubProfiles?.[npub]
        : undefined
      const isCurrentDevice = npub === account?.nostr?.deviceNpub
      const deviceDisplayName = isCurrentDevice
        ? account?.nostr?.deviceDisplayName
        : undefined
      const devicePicture = isCurrentDevice
        ? account?.nostr?.devicePicture
        : undefined
      const alias = npub ? (aliases[npub] ?? '').trim() : ''
      const npubShort = npub
        ? formatNpubText(msg.author)
        : msg.author.slice(0, 8)
      newFormattedNpubs.set(msg.author, {
        alias: alias || undefined,
        color,
        displayName:
          profile?.displayName ??
          accountProfile?.displayName ??
          deviceDisplayName,
        npubShort,
        picture: profile?.picture ?? accountProfile?.picture ?? devicePicture
      })
    }

    setFormattedNpubs(newFormattedNpubs)
  }, [
    memoizedMessages,
    membersList,
    profiles,
    account?.nostr?.npubAliases,
    account?.nostr?.npubProfiles,
    account?.nostr?.deviceNpub,
    account?.nostr?.deviceDisplayName,
    account?.nostr?.devicePicture
  ])

  // Fetch kind0 profiles for authors we haven't resolved yet.
  // Fire-and-forget: results land in the persisted nostr store.
  useEffect(() => {
    if (!account?.nostr?.relays?.length) {
      return
    }

    const { relays } = account.nostr
    const fetchedRef = new Set<string>()

    async function fetchMissingProfiles() {
      for (const msg of memoizedMessages) {
        if (!msg.author) {
          continue
        }
        let npub: string
        try {
          npub = nip19.npubEncode(msg.author)
        } catch {
          continue
        }
        // Skip if we already have profile data or are already fetching this run
        if (
          profiles[npub]?.displayName ||
          profiles[npub]?.picture ||
          fetchedRef.has(npub)
        ) {
          continue
        }
        fetchedRef.add(npub)

        try {
          const api = new NostrAPI(relays)
          const result = await api.fetchKind0(npub)
          if (result?.displayName || result?.picture) {
            setProfile(npub, {
              displayName: result.displayName,
              picture: result.picture
            })
          }
        } catch {
          // ignore fetch errors — truncated npub remains as fallback
        }
      }
    }
    fetchMissingProfiles()
  }, [memoizedMessages, profiles, account?.nostr?.relays, setProfile])

  useEffect(() => {
    const prevCount = prevMessageCountRef.current
    if (messages.length > prevCount && !isAtBottomRef.current) {
      setShowNewMessageButton(true)
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length])

  function handleScrollToBottom() {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ animated: true, offset: 0 })
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
    const atBottom = contentOffset.y <= SCROLL_THRESHOLD
    if (isAtBottomRef.current !== atBottom) {
      isAtBottomRef.current = atBottom
      if (atBottom) {
        setShowNewMessageButton(false)
      }
    }
    const nearTop =
      contentSize.height > layoutMeasurement.height &&
      contentOffset.y >=
        contentSize.height - layoutMeasurement.height - SCROLL_THRESHOLD
    if (
      nearTop &&
      displayCount < messages.length &&
      Date.now() - lastLoadMoreAtRef.current > 300
    ) {
      lastLoadMoreAtRef.current = Date.now()
      setDisplayCount((c) => Math.min(c + PAGE_SIZE, messages.length))
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

  if (!accountId || !account) {
    return <Redirect href="/" />
  }

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
          {messages.length === 0 && (
            <View style={styles.loadingContainer}>
              <SSText center color="muted">
                {t('account.nostrSync.devicesGroupChat.loadingMessages')}
              </SSText>
            </View>
          )}
          <FlatList
            ref={flatListRef}
            data={displayedMessages}
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
              messages.length > 0 ? (
                <SSText center color="muted">
                  {t('account.nostrSync.devicesGroupChat.noMessages')}
                </SSText>
              ) : null
            }
            inverted
            initialNumToRender={25}
            maxToRenderPerBatch={15}
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
            placeholderTextColor={Colors.gray[500]}
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
  authorIndicator: {
    borderRadius: 4,
    height: 8,
    marginRight: 3,
    marginTop: 1,
    width: 8
  },
  deviceMessage: {
    backgroundColor: Colors.gray[800]
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
  loadingContainer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1
  },
  message: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    marginTop: 8,
    padding: 10,
    paddingBottom: 15,
    paddingTop: 5
  },
  messagesContainer: {
    flex: 1,
    paddingBottom: 8
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
  },
  signFlowButton: {
    alignSelf: 'flex-start',
    marginTop: 8
  },
  statusContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center'
  }
})
