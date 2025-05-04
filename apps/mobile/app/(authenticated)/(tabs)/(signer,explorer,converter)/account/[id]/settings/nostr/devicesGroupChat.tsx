import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { compressMessage, NostrAPI, type NostrMessage } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import useNostrLabelSync from '@/hooks/useNostrLabelSync'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { type DM } from '@/types/models/Account'

interface MessageContent {
  description: string
  created_at: number
}

function SSDevicesGroupChat() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const [messages, setMessages] = useState<NostrMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [nostrApi, setNostrApi] = useState<NostrAPI | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const processedMessageIds = useRef<Set<string>>(new Set())
  const hasLoadedInitialMessages = useRef(false)
  const flatListRef = useRef<FlatList>(null)
  const storedDmIds = useRef<Set<string>>(new Set())

  const { loadStoredDMs, processEvent, clearStoredDMs } = useNostrLabelSync()

  const [account] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId)
    ])
  )

  // Load initial messages and cache stored DM IDs
  useEffect(() => {
    const loadMessages = async () => {
      if (!account || hasLoadedInitialMessages.current) return

      try {
        const dms = await loadStoredDMs(account)
        if (dms && Array.isArray(dms)) {
          const parsedMessages = dms
            .map((dm: DM) => {
              storedDmIds.current.add(dm.id)
              processedMessageIds.current.add(dm.id)
              return {
                content: {
                  description: dm.description
                } as MessageContent,
                created_at: dm.created_at
              } as NostrMessage
            })
            .sort((a, b) => a.created_at - b.created_at)
          setMessages(parsedMessages)
          hasLoadedInitialMessages.current = true
        }
      } catch {
        setError('Failed to load messages')
      }
    }
    loadMessages()
  }, [account, loadStoredDMs])

  const handleClearMessages = async () => {
    if (!account) return

    try {
      setIsLoading(true)
      await clearStoredDMs(account)
      setMessages([])
      storedDmIds.current.clear()
      processedMessageIds.current.clear()
      toast.success('Messages cleared successfully')
    } catch {
      toast.error('Failed to clear messages')
    } finally {
      setIsLoading(false)
    }
  }

  // Subscribe to new messages
  useEffect(() => {
    if (!nostrApi || !account?.nostr?.commonNsec || !account?.nostr?.deviceNsec)
      return

    let isSubscribed = true
    const subscribeToMessages = async () => {
      try {
        await nostrApi.subscribeToKind1059(
          account.nostr.commonNsec as string,
          account.nostr.deviceNsec as string,
          async (message) => {
            if (!isSubscribed) return

            const eventId = message.content.id

            // Skip if we've already processed this message
            if (processedMessageIds.current.has(eventId)) {
              return
            }

            // Skip if this is a stored DM
            if (storedDmIds.current.has(eventId)) {
              return
            }

            try {
              const eventContent = await processEvent(account, message.content)

              if (
                typeof eventContent === 'object' &&
                'description' in eventContent &&
                !('data' in eventContent)
              ) {
                processedMessageIds.current.add(eventId)

                setMessages((prev) => {
                  const newMessage = {
                    content: {
                      description: (eventContent as { description: string })
                        .description
                    },
                    created_at: message.content.created_at
                  }
                  const newMessages = [...prev, newMessage]
                  return newMessages.sort((a, b) => a.created_at - b.created_at)
                })
              }
            } catch {
              // Silently handle processing errors
            }
          }
        )
      } catch {
        if (isSubscribed) {
          setError('Failed to subscribe to messages')
          toast.error('Failed to subscribe to messages')
        }
      }
    }

    subscribeToMessages()

    return () => {
      isSubscribed = false
      if (nostrApi) {
        nostrApi.disconnect()
      }
    }
  }, [
    nostrApi,
    account?.nostr?.commonNsec,
    account?.nostr?.deviceNsec,
    account,
    processEvent
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

    return () => {
      api.disconnect()
      setIsConnected(false)
    }
  }, [account?.nostr?.relays])

  const handleSendMessage = async () => {
    if (!messageInput.trim()) {
      toast.error('Message cannot be empty')
      return
    }

    if (
      !nostrApi ||
      !account?.nostr?.commonNsec ||
      !account?.nostr?.commonNpub
    ) {
      toast.error('Missing required data to send message')
      return
    }

    setIsLoading(true)
    try {
      const messageContent = JSON.stringify({
        created_at: Math.floor(Date.now() / 1000),
        label: 1,
        description: messageInput.trim()
      })

      const compressedMessage = compressMessage(JSON.parse(messageContent))

      const event = await nostrApi.createKind1059(
        account.nostr.commonNsec,
        account.nostr.commonNpub,
        compressedMessage
      )

      await nostrApi.publishEvent(event)
      setMessageInput('')
      toast.success('Message sent successfully')
    } catch {
      setError('Failed to send message')
      toast.error('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const renderMessage = useCallback(
    ({ item: msg }: { item: NostrMessage }) => (
      <SSVStack gap="sm" style={styles.message}>
        <SSText size="sm" color="muted">
          {new Date(msg.created_at * 1000).toLocaleString()}
        </SSText>
        <SSText size="sm" color="muted">
          {
            // add npubAuthor
          }
        </SSText>
        <SSText>{msg.content.description}</SSText>
      </SSVStack>
    ),
    []
  )

  const keyExtractor = useCallback(
    (item: NostrMessage, index: number) => `${item.created_at}-${index}`,
    []
  )

  if (!accountId || !account) return <Redirect href="/" />

  return (
    <SSMainLayout style={{ paddingTop: 0, paddingBottom: 20 }}>
      <SSVStack gap="sm" style={{ flex: 1 }}>
        <SSVStack gap="sm">
          <SSText center uppercase color="muted">
            {t('account.nostrlabels.devicesGroupChat')}
          </SSText>
          <SSButton
            label="Clear All Messages"
            onPress={handleClearMessages}
            disabled={isLoading || messages.length === 0}
            variant="secondary"
          />
        </SSVStack>

        {/* Connection status */}
        <SSVStack gap="sm">
          {isLoading ? (
            <SSVStack style={styles.statusContainer}>
              <ActivityIndicator />
              <SSText color="muted">Connecting to relays...</SSText>
            </SSVStack>
          ) : error ? (
            <SSText color="muted" center>
              {error}
            </SSText>
          ) : (
            <SSText color="muted" center>
              {isConnected ? 'Connected to relays' : 'Disconnected'}
            </SSText>
          )}
        </SSVStack>

        {/* Messages section */}
        <View style={styles.messagesContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            onLayout={() => flatListRef.current?.scrollToEnd()}
            ListEmptyComponent={
              <SSText center color="muted">
                No messages yet
              </SSText>
            }
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
          />
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
            label="Send Message"
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
    paddingHorizontal: 10
  },
  message: {
    backgroundColor: '#1a1a1a',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8
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
  }
})

export default SSDevicesGroupChat
