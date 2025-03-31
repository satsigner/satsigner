import { Redirect, Stack, useLocalSearchParams, router } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'
import * as bip39 from 'bip39'
import {
  generateSecretKey,
  nip19,
  getPublicKey,
  nip04,
  finalizeEvent
} from 'nostr-tools'
import { useState, useEffect } from 'react'
import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import { ScrollView } from 'react-native'
import { t } from '@/locales'
import SSText from '@/components/SSText'
import SSButton from '@/components/SSButton'
import SSTextInput from '@/components/SSTextInput'
import SSVStack from '@/layouts/SSVStack'
import SSHStack from '@/layouts/SSHStack'
import SSCheckbox from '@/components/SSCheckbox'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import {
  formatAddressLabels,
  formatTransactionLabels,
  formatUtxoLabels,
  type Label,
  bip329export
} from '@/utils/bip329'

const POPULAR_RELAYS = [
  { url: 'wss://nos.lol', name: 'Nos.lol' },
  { url: 'wss://nostr.mom', name: 'Nostr Mom' },
  { url: 'wss://nostr.wine', name: 'Nostr Wine' },
  { url: 'wss://offchain.pub', name: 'Offchain' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
  { url: 'wss://relay.snort.social', name: 'Snort' }
]

export default function NostrSettings() {
  const { id: currentAccountId } = useLocalSearchParams<AccountSearchParams>()
  const [nsec, setNsec] = useState('')
  const [npub, setNpub] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [selectedRelays, setSelectedRelays] = useState<string[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null)
  const [customRelayUrl, setCustomRelayUrl] = useState('')
  const [displayMessageCount, setDisplayMessageCount] = useState(3)
  const [expandedMessages, setExpandedMessages] = useState<number[]>([])

  const [account, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === currentAccountId),
      state.updateAccount
    ])
  )

  // Load saved relays when component mounts
  useEffect(() => {
    if (account?.nostrRelays) {
      setSelectedRelays(account.nostrRelays)
    }
  }, [account?.nostrRelays])

  // Fetch messages when npub or selected relays change
  useEffect(() => {
    if (npub && selectedRelays.length > 0) {
      fetchMessages()
    }
  }, [npub, selectedRelays])

  async function fetchMessages() {
    if (!npub || !secretKey) return

    setIsLoading(true)
    try {
      const ndk = new NDK({
        explicitRelayUrls: selectedRelays
      })
      await ndk.connect()

      const user = ndk.getUser({ npub })
      const ourPubkey = getPublicKey(secretKey)

      // Get all nip04 encrypted messages (kind 4) where we are either the sender or recipient
      const messages = await ndk.fetchEvents({
        kinds: [4], // nip04 encrypted messages
        authors: [ourPubkey, user.pubkey],
        limit: 100 // Increased limit to get more messages
      })

      // Decrypt messages
      const decryptedMessages = await Promise.all(
        Array.from(messages).map(async (msg) => {
          try {
            // Determine if we're the sender or recipient
            const isSender = msg.pubkey === ourPubkey
            const otherPubkey = isSender ? user.pubkey : ourPubkey

            // Decrypt the message
            const decryptedContent = await nip04.decrypt(
              secretKey,
              otherPubkey,
              msg.content
            )

            return {
              ...msg,
              decryptedContent,
              isSender
            }
          } catch (error) {
            console.error('Error decrypting message:', error)
            return {
              ...msg,
              decryptedContent: '[Failed to decrypt]',
              isSender: msg.pubkey === ourPubkey
            }
          }
        })
      )

      // Sort messages by timestamp, newest first
      decryptedMessages.sort(
        (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
      )
      setMessages(decryptedMessages)
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function handleRelayToggle(relayUrl: string) {
    const newSelectedRelays = selectedRelays.includes(relayUrl)
      ? selectedRelays.filter((url) => url !== relayUrl)
      : [...selectedRelays, relayUrl]

    setSelectedRelays(newSelectedRelays)

    // Update account with new relays
    if (account) {
      updateAccount({
        ...account,
        nostrRelays: newSelectedRelays
      })
    }
  }

  async function handleCreateNsec() {
    try {
      const mnemonic = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'
      const seed = await bip39.mnemonicToSeed(mnemonic, passphrase)
      const newSecretKey = new Uint8Array(seed.slice(0, 32))
      setSecretKey(newSecretKey)
      const newNsec = nip19.nsecEncode(newSecretKey)
      console.log('Created nsec:', newNsec)
      setNsec(newNsec)

      const publicKey = getPublicKey(newSecretKey)
      const newNpub = nip19.npubEncode(publicKey)
      console.log('Derived npub:', newNpub)
      setNpub(newNpub)
    } catch (error) {
      console.error('Error creating nsec:', error)
    }
  }

  async function handleSendMessage() {
    if (!secretKey || !npub || selectedRelays.length === 0 || !account) return

    try {
      console.log('Sending message to relays:', selectedRelays)

      const ndk = new NDK({
        explicitRelayUrls: selectedRelays
      })
      await ndk.connect()

      // Get our public key
      const ourPubkey = getPublicKey(secretKey)

      // Decode our public key from npub
      const { data: recipientPubkey } = nip19.decode(npub)

      // Format labels
      const labels = [
        ...formatTransactionLabels(account.transactions),
        ...formatUtxoLabels(account.utxos),
        ...formatAddressLabels(account.addresses)
      ] as Label[]

      // Create message content with labels in JSONL format
      const messageContent = labels.length > 0 ? bip329export.JSONL(labels) : ''

      // Create nip04 encrypted message
      const encryptedMessage = await nip04.encrypt(
        secretKey,
        recipientPubkey as string,
        messageContent
      )
      console.log('encryptedMessage:', encryptedMessage)

      // Create and publish the event
      const event = new NDKEvent(ndk, {
        kind: 4, // nip04 encrypted message
        pubkey: ourPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientPubkey as string]], // recipient's pubkey
        content: encryptedMessage
      })

      // Convert secret key to hex string for NDKPrivateKeySigner
      const secretKeyHex = Array.from(secretKey)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const signer = new NDKPrivateKeySigner(secretKeyHex)
      await event.sign(signer)

      // Log the signed event details
      console.log('Signed event:', JSON.stringify(event.rawEvent(), null, 2))

      await event.publish()

      // Refresh messages
      await fetchMessages()
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  // Add function to handle custom relay addition
  function handleAddCustomRelay() {
    if (!customRelayUrl) return

    // Basic validation for websocket URL
    if (!customRelayUrl.startsWith('wss://')) {
      console.error('Invalid relay URL. Must start with wss://')
      return
    }

    // Add custom relay if it's not already in the list
    if (!selectedRelays.includes(customRelayUrl)) {
      const newSelectedRelays = [...selectedRelays, customRelayUrl]
      setSelectedRelays(newSelectedRelays)

      // Update account with new relays
      if (account) {
        updateAccount({
          ...account,
          nostrRelays: newSelectedRelays
        })
      }
    }

    // Clear the input
    setCustomRelayUrl('')
  }

  // Add function to toggle message expansion
  const toggleMessageExpansion = (index: number) => {
    setExpandedMessages((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }

  // Add function to format message content
  const formatMessageContent = (content: string, index: number) => {
    if (content.length <= 200 || expandedMessages.includes(index)) {
      return (
        <SSVStack gap="xxs">
          <SSText>{content}</SSText>
          {content.length > 200 && (
            <SSText
              color="white"
              onPress={() => toggleMessageExpansion(index)}
              style={{ textDecorationLine: 'underline' }}
            >
              See less
            </SSText>
          )}
        </SSVStack>
      )
    }

    return (
      <SSVStack gap="xxs">
        <SSText>{content.slice(0, 200)}...</SSText>
        <SSText
          color="white"
          onPress={() => toggleMessageExpansion(index)}
          style={{ textDecorationLine: 'underline' }}
        >
          See more
        </SSText>
      </SSVStack>
    )
  }

  if (!currentAccountId || !account) return <Redirect href="/" />

  return (
    <ScrollView>
      <SSVStack gap="lg" style={{ padding: 20 }}>
        <Stack.Screen
          options={{
            headerTitle: () => <SSText uppercase>{account.name}</SSText>
          }}
        />
        <SSVStack gap="md">
          <SSText center uppercase color="muted">
            NOSTR Label Sync
          </SSText>

          <SSText>Select Relays</SSText>
          {POPULAR_RELAYS.map((relay) => (
            <SSVStack key={relay.url} gap="xxs">
              <SSCheckbox
                label={relay.url}
                selected={selectedRelays.includes(relay.url)}
                onPress={() => handleRelayToggle(relay.url)}
              />
            </SSVStack>
          ))}

          {/* Add custom relay section */}
          <SSVStack gap="sm">
            <SSText>Add Custom Relay</SSText>
            <SSTextInput
              placeholder="wss://your-relay.com"
              value={customRelayUrl}
              onChangeText={setCustomRelayUrl}
            />
            <SSButton
              label="Add Relay"
              variant="secondary"
              onPress={handleAddCustomRelay}
              disabled={!customRelayUrl.startsWith('wss://')}
            />
          </SSVStack>

          {/* Show custom relays if any */}
          {selectedRelays
            .filter((url) => !POPULAR_RELAYS.some((relay) => relay.url === url))
            .map((url) => (
              <SSVStack key={url} gap="xxs">
                <SSCheckbox
                  label={url}
                  selected={true}
                  onPress={() => handleRelayToggle(url)}
                />
              </SSVStack>
            ))}
        </SSVStack>
        <SSVStack gap="md">
          <SSText>Mnemonic Passphrase (optional)</SSText>
          <SSTextInput
            placeholder="Enter passphrase"
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
          />
        </SSVStack>
        <SSButton
          label="Derive nsec"
          variant="gradient"
          onPress={handleCreateNsec}
        />
        {nsec && (
          <SSVStack gap="xxs">
            <SSText>Private Key (nsec)</SSText>
            <SSText>{nsec}</SSText>
            <SSText>Public Key (npub)</SSText>
            <SSText>{npub}</SSText>
          </SSVStack>
        )}
        {npub && (
          <SSVStack gap="md">
            <SSButton
              label="Check for messages"
              variant="gradient"
              onPress={fetchMessages}
              disabled={isLoading}
            />
          </SSVStack>
        )}
        {npub && (
          <SSButton
            label="Send Labels to Relays"
            variant="secondary"
            onPress={handleSendMessage}
          />
        )}
        {messages.length > 0 && (
          <SSVStack gap="md">
            <SSHStack gap="md" justifyBetween>
              <SSText>Latest Messages</SSText>
              {isLoading && <SSText color="muted">Loading messages...</SSText>}
            </SSHStack>
            {messages.slice(0, displayMessageCount).map((msg, index) => (
              <SSVStack
                key={index}
                gap="sm"
                style={{
                  backgroundColor: '#1a1a1a',
                  padding: 10,
                  borderRadius: 8
                }}
              >
                <SSText color={msg.isSender ? 'white' : 'muted'}>
                  {msg.isSender ? 'Content Sent' : 'Content Received'}:
                </SSText>
                {formatMessageContent(msg.decryptedContent, index)}
                <SSText size="sm" color="muted">
                  {new Date(msg.created_at * 1000).toLocaleString()}
                </SSText>
                {msg.decryptedContent.startsWith('{"label":') && (
                  <SSButton
                    label="Import Labels"
                    variant="outline"
                    onPress={() => {
                      try {
                        const labels = JSON.parse(msg.decryptedContent)
                        if (account) {
                          // TODO: Implement label import logic
                          console.log('Importing labels:', labels)
                        }
                      } catch (error) {
                        console.error('Error parsing labels:', error)
                      }
                    }}
                  />
                )}
              </SSVStack>
            ))}
            {messages.length > displayMessageCount && (
              <SSButton
                label={`Load More Messages (${messages.length - displayMessageCount} remaining)`}
                variant="gradient"
                onPress={() => setDisplayMessageCount((prev) => prev + 3)}
              />
            )}
          </SSVStack>
        )}
      </SSVStack>
    </ScrollView>
  )
}
