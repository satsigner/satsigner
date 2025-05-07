import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI, type NostrMessage } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import SSText from '@/components/SSText'
import useNostrSync from '@/hooks/useNostrSync'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { type DM } from '@/types/models/Account'
import { nip19 } from 'nostr-tools'

interface MessageContent {
  description: string
  created_at: number
  pubkey?: string
}

// Cache for storing calculated colors
const colorCache = new Map<string, { text: string; color: string }>()

export async function formatNpub(
  pubkey: string,
  members: Array<{ npub: string; color: string }>
): Promise<{ text: string; color: string }> {
  if (!pubkey) return { text: 'Unknown sender', color: '#666666' }

  // Clear cache if members array is empty to ensure fresh colors
  if (members.length === 0) {
    colorCache.clear()
  }

  const cached = colorCache.get(pubkey)
  if (cached) {
    return cached
  }

  try {
    const npub = nip19.npubEncode(pubkey)
    const member = members.find((m) => m.npub === npub)
    const color = member?.color || '#404040'
    const result = { text: `${npub.slice(0, 12)}...${npub.slice(-4)}`, color }
    colorCache.set(pubkey, result)
    return result
  } catch {
    return { text: 'Unknown sender', color: '#666666' }
  }
}

const MessageItem = memo(function MessageItem({
  message,
  members
}: {
  message: NostrMessage
  members: Array<{ npub: string; color: string }>
}) {
  const [formattedNpub, setFormattedNpub] = useState<{
    text: string
    color: string
  }>({ text: '', color: '#cccccc' })

  useEffect(() => {
    if (message.pubkey) {
      formatNpub(message.pubkey, members)
        .then(setFormattedNpub)
        .catch(() => {
          setFormattedNpub({ text: 'Unknown sender', color: '#666666' })
        })
    }
  }, [message.pubkey, members])

  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const [account] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId)
    ])
  )

  const isDeviceMessage = (() => {
    if (!message.pubkey || !account?.nostr?.deviceNpub) return false
    try {
      return nip19.npubEncode(message.pubkey) === account.nostr.deviceNpub
    } catch {
      return false
    }
  })()

  return (
    <SSVStack
      gap="xxs"
      style={[styles.message, isDeviceMessage && styles.deviceMessage]}
    >
      <SSHStack gap="xxs" justifyBetween>
        <SSHStack gap="xxs">
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: formattedNpub.color,
              marginTop: 1,
              marginRight: 3
            }}
          />
          <SSText size="sm" color="muted">
            {formattedNpub.text}
          </SSText>
        </SSHStack>
        <SSText size="sm" color="muted">
          {new Date(message.created_at * 1000).toLocaleString()}
        </SSText>
      </SSHStack>
      <SSText size="md">
        {typeof message.content === 'object' && 'description' in message.content
          ? message.content.description
          : typeof message.content === 'string'
            ? message.content
            : 'Invalid message format'}
      </SSText>
    </SSVStack>
  )
})

function SSDevicesGroupChat() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const getMembers = useNostrStore((state) => state.getMembers)
  const addMember = useNostrStore((state) => state.addMember)
  const { sendDM, loadStoredDMs, dataExchangeSubscription } = useNostrSync()
  const members = useMemo(
    () => (accountId ? getMembers(accountId) : []),
    [accountId, getMembers]
  )
  const [messages, setMessages] = useState<NostrMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [nostrApi, setNostrApi] = useState<NostrAPI | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedInitialMessages = useRef(false)
  const flatListRef = useRef<FlatList>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const [account] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId)
    ])
  )

  // Add user's device to members list if not already present
  useEffect(() => {
    if (account?.nostr?.deviceNpub && accountId) {
      addMember(accountId, account.nostr.deviceNpub)
    }
  }, [account?.nostr?.deviceNpub, accountId, addMember])

  // Clear color cache when members change
  useEffect(() => {
    colorCache.clear()
  }, [members])

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      if (!account || hasLoadedInitialMessages.current) return

      try {
        const dms = await loadStoredDMs(account)
        if (dms && Array.isArray(dms)) {
          const parsedMessages = dms.map(
            (dm: DM) =>
              ({
                content: {
                  description: dm.description
                } as MessageContent,
                created_at: dm.created_at,
                pubkey: dm.author
              }) as NostrMessage
          )

          // Sort messages by creation time
          parsedMessages.sort((a, b) => a.created_at - b.created_at)
          setMessages(parsedMessages)
          hasLoadedInitialMessages.current = true

          // Scroll to bottom after initial messages are loaded
          setTimeout(() => {
            if (flatListRef.current && parsedMessages.length > 0) {
              flatListRef.current.scrollToEnd({ animated: false })
            }
          }, 100)
        }
      } catch {
        setError('Failed to load messages')
      }
    }
    loadMessages()
  }, [account, loadStoredDMs])

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y
    setShowScrollButton(distanceFromBottom > 100)
  }, [])

  const scrollToBottom = useCallback(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true })
    }
  }, [])

  // Subscribe to new messages
  useEffect(() => {
    if (
      !nostrApi ||
      !account?.nostr?.commonNsec ||
      !account?.nostr?.deviceNsec ||
      !account?.nostr?.autoSync ||
      !accountId
    )
      return

    dataExchangeSubscription(account)

    // Load messages from store whenever they change
    const loadMessages = async () => {
      const dms = await loadStoredDMs(account)
      if (dms && Array.isArray(dms)) {
        const parsedMessages = dms.map(
          (dm: DM) =>
            ({
              content: {
                description: dm.description
              } as MessageContent,
              created_at: dm.created_at,
              pubkey: dm.author
            }) as NostrMessage
        )

        // Sort messages by creation time
        parsedMessages.sort((a, b) => a.created_at - b.created_at)
        setMessages(parsedMessages)

        // Scroll to bottom after messages are loaded
        setTimeout(() => {
          if (flatListRef.current && parsedMessages.length > 0) {
            flatListRef.current.scrollToEnd({ animated: false })
          }
        }, 100)
      }
    }

    loadMessages()
  }, [
    nostrApi,
    account?.nostr?.commonNsec,
    account?.nostr?.deviceNsec,
    account,
    dataExchangeSubscription,
    loadStoredDMs,
    accountId
  ])

  // Connect to relays
  useEffect(() => {
    if (!account?.nostr?.relays?.length) {
      setError('No relays configured')
      return
    }

    const api = new NostrAPI(account.nostr.relays)
    setNostrApi(api)
    setIsLoading(true)

    api
      .connect()
      .then(() => {
        setIsConnected(true)
        setError(null)
      })
      .catch(() => {
        setError('Failed to connect to relays')
        toast.error('Failed to connect to relays')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [account?.nostr?.relays])

  const handleSendMessage = async () => {
    if (!messageInput.trim()) {
      toast.error('Message cannot be empty')
      return
    }

    if (!account?.nostr?.autoSync) {
      toast.error('Auto-sync must be enabled to send messages')
      return
    }

    if (
      !account?.nostr?.commonNsec ||
      !account?.nostr?.commonNpub ||
      !account?.nostr?.deviceNpub ||
      !account?.nostr?.relays?.length
    ) {
      toast.error('Missing required Nostr configuration')
      return
    }

    setIsLoading(true)
    try {
      await sendDM(account, messageInput.trim())
      setMessageInput('')
      toast.success('Message sent successfully')
    } catch (_error) {
      setError('Failed to send message')
      toast.error('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const renderMessage = useCallback(
    ({ item: msg }: { item: NostrMessage }) => {
      return <MessageItem message={msg} members={members} />
    },
    [members]
  )

  const keyExtractor = useCallback(
    (item: NostrMessage) => `${item.created_at}-${item.pubkey}`,
    []
  )

  if (!accountId || !account) return <Redirect href="/" />

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
              {account.policyType === 'watchonly' && (
                <SSIconEyeOn stroke="#fff" height={16} width={16} />
              )}
            </SSHStack>
          ),
          headerRight: () => null
        }}
      />
      <SSVStack gap="sm" style={{ flex: 1 }}>
        <SSVStack gap="sm">
          <SSVStack gap="xs">
            <SSText center uppercase color="muted">
              {t('account.nostrSync.devicesGroupChat')}
            </SSText>

            {isLoading ? (
              <SSVStack style={styles.statusContainer}>
                {!account?.nostr?.relays?.length ? (
                  <SSText color="muted">No relay selected</SSText>
                ) : (
                  <>
                    <ActivityIndicator size={15} color={Colors.white} />
                    <SSText color="muted">Connecting to relays</SSText>
                  </>
                )}
              </SSVStack>
            ) : error ? (
              <SSText color="muted" center>
                {error}
              </SSText>
            ) : (
              <SSText color="muted" center>
                {isConnected ? 'Connected to relays' : 'Disconnected'}
                {account.nostr.autoSync ? '' : ' • Sync Off'}
              </SSText>
            )}
          </SSVStack>
        </SSVStack>

        {/* Messages section */}
        <View style={styles.messagesContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <SSText center color="muted">
                No messages yet
              </SSText>
            }
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={100}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10
            }}
            inverted={false}
            onLayout={() => {
              if (flatListRef.current && messages.length > 0) {
                flatListRef.current.scrollToEnd({ animated: false })
              }
            }}
            onContentSizeChange={() => {
              if (flatListRef.current && messages.length > 0) {
                flatListRef.current.scrollToEnd({ animated: false })
              }
            }}
          />
          {showScrollButton && (
            <SSButton
              label="↓"
              onPress={scrollToBottom}
              style={styles.scrollButton}
              variant="outline"
            />
          )}
        </View>

        {/* Message input section */}
        <SSHStack gap="sm" style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={messageInput}
            onChangeText={setMessageInput}
            placeholder="Type your message..."
            placeholderTextColor={Colors.white}
            multiline
            maxLength={500}
          />
          <SSButton
            style={styles.sendButton}
            label="Send"
            onPress={handleSendMessage}
            disabled={isLoading || !isConnected || !messageInput.trim()}
          />
        </SSHStack>
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  messagesContainer: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    paddingHorizontal: 8,
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
    backgroundColor: '#2f2f2f'
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
  scrollButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    opacity: 0.8
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white
  },
  messageContent: {
    flex: 1,
    paddingLeft: 10
  },
  npub: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white
  },
  messageText: {
    fontSize: 14,
    color: Colors.white
  }
})

export default SSDevicesGroupChat
