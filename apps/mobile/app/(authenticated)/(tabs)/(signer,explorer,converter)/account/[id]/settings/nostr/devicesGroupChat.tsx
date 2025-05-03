import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI, type NostrMessage } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

function SSDevicesGroupChat() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const [messages, setMessages] = useState<NostrMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [nostrApi, setNostrApi] = useState<NostrAPI | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [account] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId)
    ])
  )

  // Subscribe to new messages
  useEffect(() => {
    if (!nostrApi || !account?.nostr?.commonNsec || !account?.nostr?.deviceNsec)
      return
    toast.info(account.nostr.commonNsec)
    const subscribeToMessages = async () => {
      try {
        await nostrApi.subscribeToKind1059New(
          account.nostr.commonNsec,
          account.nostr.deviceNsec,
          (message) => {
            if (message.decryptedContent) {
              setMessages((prev) => [message, ...prev])
              toast.info('New message received')
            } else {
              toast.error('New message received')
            }
          }
        )
      } catch (_error) {
        setError('Failed to subscribe to messages')
        toast.error('Failed to subscribe to messages')
      }
    }

    subscribeToMessages()
  }, [nostrApi, account?.nostr?.commonNsec, account?.nostr?.deviceNsec])

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
      .catch((_error) => {
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
        content: messageInput.trim()
      })

      const event = await nostrApi.createKind1059WrappedEvent(
        account.nostr.commonNsec,
        account.nostr.commonNpub,
        messageContent
      )

      await nostrApi.sendMessage(event)
      setMessageInput('')
      toast.success('Message sent successfully')
    } catch (_error) {
      setError('Failed to send message')
      toast.error('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  if (!accountId || !account) return <Redirect href="/" />

  return (
    <SSMainLayout style={{ paddingTop: 0, paddingBottom: 20 }}>
      <ScrollView>
        <SSVStack gap="lg">
          <SSText center uppercase color="muted">
            {t('account.nostrlabels.devicesGroupChat')}
          </SSText>

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
          <SSVStack gap="md" style={styles.messagesContainer}>
            {messages.length > 0 ? (
              messages.map((msg, index) => (
                <SSVStack key={index} gap="sm" style={styles.message}>
                  <SSText size="sm" color="muted">
                    {new Date(msg.created_at * 1000).toLocaleString()}
                  </SSText>
                  <SSText>{msg.decryptedContent}</SSText>
                </SSVStack>
              ))
            ) : (
              <SSText center color="muted">
                No messages yet
              </SSText>
            )}
          </SSVStack>

          {/* Message input section */}
          <SSVStack gap="sm" style={styles.inputContainer}>
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
              label="Send Message"
              onPress={handleSendMessage}
              disabled={isLoading || !isConnected || !messageInput.trim()}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  messagesContainer: {
    marginTop: 20
  },
  message: {
    backgroundColor: '#1a1a1a',
    padding: 10,
    borderRadius: 8
  },
  inputContainer: {
    marginTop: 20,
    paddingHorizontal: 10
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: Colors.white,
    padding: 10,
    borderRadius: 8,
    minHeight: 80,
    textAlignVertical: 'top'
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  }
})

export default SSDevicesGroupChat
