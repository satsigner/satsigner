import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { nip19 } from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import useNostrSync from '@/hooks/useNostrSync'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import type { DM } from '@/types/models/Account'

// Cache for npub colors
const colorCache = new Map<string, { text: string; color: string }>()

async function formatNpub(
  pubkey: string,
  members: Array<{ npub: string; color: string }>
): Promise<{ text: string; color: string }> {
  if (!pubkey) return { text: 'Unknown sender', color: '#666666' }

  const cached = colorCache.get(pubkey)
  if (cached) {
    return cached
  }

  try {
    const npub = nip19.npubEncode(pubkey)
    const member = members.find((m) => m.npub === npub)

    console.log('🔍 Looking for member:', {
      pubkey,
      npub,
      foundMember: member,
      allMembers: members
    })

    const color = member?.color || '#404040'
    const result = {
      text: `${npub.slice(0, 12)}...${npub.slice(-4)}`,
      color
    }
    colorCache.set(pubkey, result)
    return result
  } catch (error) {
    return { text: pubkey.slice(0, 8), color: '#404040' }
  }
}

function SSDevicesGroupChat() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const [isLoading, setIsLoading] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const flatListRef = useRef<FlatList>(null)
  const nostrApiRef = useRef<NostrAPI | null>(null)
  const [formattedNpubs, setFormattedNpubs] = useState<
    Map<string, { text: string; color: string }>
  >(new Map())

  const [account] = useAccountsStore((state) => [
    state.accounts.find((_account) => _account.id === accountId)
  ])

  const { members } = useNostrStore((state) => ({
    members: state.members[accountId] || []
  }))

  const { sendDM, dataExchangeSubscription } = useNostrSync()

  // Load messages from account's Nostr DMs store
  const messages = account?.nostr?.dms || []

  // Format npubs for all messages
  useEffect(() => {
    const formatNpubs = async () => {
      const membersList = members.map((member) => ({
        npub: member.npub,
        color: member.color || '#404040'
      }))

      const newFormattedNpubs = new Map()
      for (const msg of messages) {
        if (!newFormattedNpubs.has(msg.author)) {
          const formatted = await formatNpub(msg.author, membersList)
          newFormattedNpubs.set(msg.author, formatted)
        }
      }
      setFormattedNpubs(newFormattedNpubs)
    }

    formatNpubs()
  }, [messages, members])

  // Log message changes
  useEffect(() => {
    if (messages.length > 0) {
      console.log('📝 Latest message:', {
        id: messages[messages.length - 1].id,
        author: messages[messages.length - 1].author,
        content: messages[messages.length - 1].description,
        timestamp: new Date(
          messages[messages.length - 1].created_at * 1000
        ).toISOString()
      })
    }
  }, [messages])

  // Load messages and setup subscription on mount
  useEffect(() => {
    if (!account?.nostr?.relays?.length) {
      return
    }

    const api = new NostrAPI(account.nostr.relays)
    nostrApiRef.current = api

    // Start listening for new messages
    dataExchangeSubscription(account, (loading) => {
      console.log('📡 Subscription loading state:', loading)
    })

    // Scroll to bottom when messages load
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: false })
    }

    return () => {
      api.closeAllSubscriptions()
    }
  }, [
    account?.nostr?.relays,
    account,
    dataExchangeSubscription,
    messages.length
  ])

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
      toast.success('Message sent successfully')
    } catch (error) {
      console.error('Failed to send message:', error)
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
      } catch (error) {
        console.error('Error rendering message:', error)
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
            </SSText>
            <SSText color="muted" center>
              {account.nostr.autoSync ? 'Sync On' : 'Sync Off'}
            </SSText>
          </SSVStack>
        </SSVStack>

        {/* Messages section */}
        <View style={styles.messagesContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false })
            }}
            ListEmptyComponent={
              <SSText center color="muted">
                No messages yet
              </SSText>
            }
            inverted={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
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
  }
})

export default SSDevicesGroupChat
