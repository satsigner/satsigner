import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, StyleSheet, TextInput, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import useNostrSync from '@/hooks/useNostrSync'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { Colors } from '@/styles'
import type { DM } from '@/types/models/Account'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

// Cache for npub colors
const colorCache = new Map<string, { text: string; color: string }>()

async function formatNpub(
  pubkey: string,
  members: { npub: string; color: string }[]
): Promise<{ text: string; color: string }> {
  if (!pubkey) return { text: 'Unknown sender', color: '#666666' }

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
  } catch (_error) {
    return { text: pubkey.slice(0, 8), color: '#404040' }
  }
}

function SSDevicesGroupChat() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const [isLoading, setIsLoading] = useState(false)
  const [isContentLoaded, setIsContentLoaded] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [messageInput, setMessageInput] = useState('')
  const flatListRef = useRef<FlatList>(null)
  const [formattedNpubs, setFormattedNpubs] = useState<
    Map<string, { text: string; color: string }>
  >(new Map())

  const [account] = useAccountsStore((state) => [
    state.accounts.find((_account) => _account.id === accountId)
  ])

  const { members } = useNostrStore((state) => {
    if (!accountId) return { members: [] }
    return {
      members: state.members?.[accountId] || []
    }
  })

  const { sendDM } = useNostrSync()

  // Load messages from account's Nostr DMs store
  const messages = useMemo(
    () => account?.nostr?.dms || [],
    [account?.nostr?.dms]
  )

  // Memoize messages to prevent unnecessary re-renders
  const memoizedMessages = useMemo(() => messages, [messages])

  // Memoize the members list to prevent unnecessary recalculations
  const membersList = useMemo(
    () =>
      members.map((member: { npub: string; color?: string }) => ({
        npub: member.npub,
        color: member.color || '#404040'
      })),
    [members]
  )

  // Keep track of which authors we've already formatted
  const formattedAuthorsRef = useRef(new Set<string>())

  // Format npubs for all messages
  useEffect(() => {
    const formatNpubs = async () => {
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

      // Only update state if we have new authors to format
      if (hasNewAuthors) {
        setFormattedNpubs((prev) => new Map([...prev, ...newFormattedNpubs]))
      }
    }

    formatNpubs()
  }, [memoizedMessages, membersList])

  // Separate effect for scrolling
  useEffect(() => {
    if (messages.length > 0 && account?.nostr?.relays?.length) {
      if (isInitialLoad) {
        setIsContentLoaded(false)
        // Wait for content to be fully rendered
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: false })
            // Double check scroll after a short delay
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: false })
              setIsContentLoaded(true)
              setIsInitialLoad(false)
            }, 200)
          }
        }, 100)
      } else {
        // For subsequent updates, just scroll without showing loading
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false })
        }
      }
    }
  }, [messages.length, account?.nostr?.relays?.length, isInitialLoad])

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
      !account?.nostr?.deviceNsec ||
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
    } catch (_error) {
      toast.error('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const renderMessage = useCallback(
    ({ item: msg }: { item: DM }) => {
      try {
        // Ensure we have a valid hex string
        const hexString = msg.author.startsWith('npub')
          ? msg.author
          : msg.author.padStart(64, '0').toLowerCase()

        // Only encode if it's not already an npub
        const msgAuthorNpub = msg.author.startsWith('npub')
          ? msg.author
          : nip19.npubEncode(hexString)

        const isDeviceMessage = msgAuthorNpub === account?.nostr?.deviceNpub
        const formatted = formattedNpubs.get(msg.author) || {
          text: msgAuthorNpub.slice(0, 12) + '...' + msgAuthorNpub.slice(-4),
          color: '#404040'
        }

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
                    backgroundColor: formatted.color,
                    marginTop: 1,
                    marginRight: 3
                  }}
                />
                <SSText size="sm" color="muted">
                  {formatted.text}
                  {isDeviceMessage && ' (You)'}
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
            <SSText size="md">
              {typeof msg.content === 'object' && 'description' in msg.content
                ? msg.content.description
                : typeof msg.content === 'string'
                  ? msg.content
                  : 'Invalid message format'}
            </SSText>
          </SSVStack>
        )
      } catch (_error) {
        return (
          <SSVStack gap="xxs" style={styles.message}>
            <SSText size="sm" color="muted">
              Error displaying message
            </SSText>
          </SSVStack>
        )
      }
    },
    [account?.nostr?.deviceNpub, formattedNpubs]
  )

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
              {t('account.nostrSync.devicesGroupChat')}
              {account.nostr.autoSync ? ' (Sync On)' : ' (Sync Off)'}
            </SSText>
          </SSVStack>
        </SSVStack>

        {/* Messages section */}
        <View style={styles.messagesContainer}>
          {!isContentLoaded && isInitialLoad && messages.length > 0 && (
            <View style={styles.loadingContainer}>
              <SSText center color="muted">
                Loading messages...
              </SSText>
            </View>
          )}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <SSText center color="muted">
                No messages yet
              </SSText>
            }
            inverted={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
            onContentSizeChange={() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: false })
              }
            }}
            onLayout={() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: false })
              }
            }}
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
            label="Send"
            onPress={handleSendMessage}
            disabled={isLoading || !messageInput.trim()}
          />
        </SSHStack>
      </SSVStack>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1
  }
})

export default SSDevicesGroupChat
