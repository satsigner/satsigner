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
import { ScrollView, useWindowDimensions } from 'react-native'
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
  bip329export,
  bip329parser
} from '@/utils/bip329'
import { aesDecrypt } from '@/utils/crypto'
import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { type Secret } from '@/types/models/Account'
import SSModal from '@/components/SSModal'

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
  const [relayError, setRelayError] = useState<string | null>(null)
  const [autoSync, setAutoSync] = useState(false)
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<
    number | null
  >(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const layout = useWindowDimensions()
  const [importCount, setImportCount] = useState(0)
  const [importCountTotal, setImportCountTotal] = useState(0)
  const [successMsgVisible, setSuccessMsgVisible] = useState(false)

  const [account, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === currentAccountId),
      state.updateAccount
    ])
  )

  const [, importLabelsToAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === currentAccountId),
      state.importLabels
    ])
  )

  // Load saved relays when component mounts
  useEffect(() => {
    if (account?.nostrRelays) {
      setSelectedRelays(account.nostrRelays)
    }
  }, [account?.nostrRelays])

  // Load saved autoSync state when component mounts
  useEffect(() => {
    if (account?.nostrLabelsAutoSync !== undefined) {
      setAutoSync(account.nostrLabelsAutoSync)
    }
  }, [account?.nostrLabelsAutoSync])

  // Load saved passphrase when component mounts
  useEffect(() => {
    if (account?.nostrPassphrase !== undefined) {
      setPassphrase(account.nostrPassphrase)
    }
  }, [account?.nostrPassphrase])

  // Modify the fetch messages useEffect to only run when autoSync is on
  useEffect(() => {
    if (autoSync && npub && selectedRelays.length > 0) {
      fetchMessages()
    }
  }, [npub, selectedRelays, autoSync])

  // Modify the auto sync useEffect to include fetchMessages in the interval
  useEffect(() => {
    if (autoSync && npub && selectedRelays.length > 0) {
      // Initial sync
      handleSendMessage()

      // Set up interval for auto sync
      const syncInterval = setInterval(() => {
        //handleSendMessage()
        fetchMessages()
      }, 60000) // Sync every minute

      // Cleanup interval on unmount or when auto sync is disabled
      return () => clearInterval(syncInterval)
    }
  }, [autoSync, npub, selectedRelays]) // eslint-disable-line react-hooks/exhaustive-deps

  // Add new useEffect to auto-execute handleCreateNsec
  useEffect(() => {
    if (account && passphrase !== undefined) {
      handleCreateNsec()
    }
  }, [account, passphrase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchMessages(loadMore: boolean = false) {
    if (!npub || !secretKey) return

    // Add relay check at the start
    if (selectedRelays.length === 0) {
      setRelayError(t('account.nostrlabels.noRelaysWarning'))
      return
    }

    setIsLoading(true)
    try {
      const ndk = new NDK({
        explicitRelayUrls: selectedRelays
      })
      await ndk.connect()

      const user = ndk.getUser({ npub })
      const ourPubkey = getPublicKey(secretKey)

      // Get nip04 encrypted messages with pagination
      const messages = await ndk.fetchEvents({
        kinds: [4], // nip04 encrypted messages
        authors: [ourPubkey, user.pubkey],
        limit: 3,
        since:
          loadMore && lastMessageTimestamp !== null
            ? lastMessageTimestamp
            : undefined
      })

      // If no messages returned, we've reached the end
      if (messages.size === 0) {
        setHasMoreMessages(false)
        setIsLoading(false)
        return
      }

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

      // Update last message timestamp for pagination
      if (decryptedMessages.length > 0) {
        setLastMessageTimestamp(
          decryptedMessages[decryptedMessages.length - 1].created_at ?? 0
        )
      }

      // Update messages state based on whether we're loading more or not
      if (loadMore) {
        setMessages((prev) => [...prev, ...decryptedMessages])
      } else {
        setMessages(decryptedMessages)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
      setRelayError(
        error instanceof Error ? error.message : 'Failed to fetch messages'
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateNsec() {
    try {
      if (!account?.keys[0].secret) {
        throw new Error('No secret found')
      }

      // Get PIN from secure storage
      const pin = await getItem(PIN_KEY)
      if (!pin) {
        throw new Error('PIN not found')
      }

      // Get IV and encrypted secret from account
      const iv = account.keys[0].iv
      const encryptedSecret = account.keys[0].secret as string

      // Decrypt the secret
      const accountSecretString = await aesDecrypt(encryptedSecret, pin, iv)
      const accountSecret = JSON.parse(accountSecretString) as Secret
      const mnemonic = accountSecret.mnemonic
      if (!mnemonic) {
        throw new Error('No mnemonic found in account secret')
      }

      // Generate Nostr keys from mnemonic
      const seed = await bip39.mnemonicToSeed(mnemonic, passphrase)
      const newSecretKey = new Uint8Array(seed.slice(0, 32))
      setSecretKey(newSecretKey)
      const newNsec = nip19.nsecEncode(newSecretKey)
      setNsec(newNsec)

      const publicKey = getPublicKey(newSecretKey)
      const newNpub = nip19.npubEncode(publicKey)
      setNpub(newNpub)
    } catch (error) {
      console.error('Error creating nsec:', error)
      setRelayError(
        error instanceof Error ? error.message : 'Failed to create nsec'
      )
    }
  }

  async function handleSendMessage() {
    if (!secretKey || !npub || !account) return

    // Add relay check at the start
    if (selectedRelays.length === 0) {
      setRelayError(t('account.nostrlabels.noRelaysWarning'))
      return
    }

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

      await event.publish()

      // Refresh messages
      await fetchMessages()
    } catch (error) {
      console.error('Error in handleSendMessage:', error)
      setRelayError(
        error instanceof Error ? error.message : 'Failed to send message'
      )
    }
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

  function handleImportLabels(content: string) {
    try {
      // Clean the content by removing control characters
      const cleanContent = content
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .trim()

      // Split concatenated JSON objects
      const jsonStrings = cleanContent.match(/\{[^}]+\}/g) || []

      // Parse each JSON object and collect valid labels
      const labels = jsonStrings
        .map((jsonString) => {
          try {
            return JSON.parse(jsonString)
          } catch (e) {
            console.error('Error parsing JSON:', jsonString, e)
            return null
          }
        })
        .filter((label) => label !== null)

      if (labels.length === 0) {
        throw new Error('No valid labels found in the message')
      }

      const importCount = importLabelsToAccount(currentAccountId!, labels)
      setImportCount(importCount)
      setImportCountTotal(labels.length)
      setSuccessMsgVisible(true)
    } catch (error) {
      console.error('Error importing labels:', error)
      setRelayError(
        error instanceof Error
          ? error.message
          : 'Failed to parse labels. Make sure the format is correct.'
      )
    }
  }

  if (!currentAccountId || !account) return <Redirect href="/" />

  return (
    <SSVStack style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <SSVStack gap="md">
          <SSText center uppercase color="muted" style={{ padding: 20 }}>
            {t('account.nostrlabels.title')}
          </SSText>

          {/* Keys display - moved to top */}
          <SSVStack
            gap="xxs"
            style={{
              padding: 15,
              backgroundColor: '#1a1a1a',
              borderRadius: 8,
              marginHorizontal: 20,
              height: 190
            }}
          >
            {nsec && (
              <SSVStack gap="md">
                <SSVStack gap="xxs">
                  <SSText color="muted" center>
                    {t('account.nostrlabels.nsec')}
                  </SSText>
                  <SSText
                    center
                    size="xl"
                    type="mono"
                    style={{ letterSpacing: 1 }}
                  >
                    {nsec}
                  </SSText>
                </SSVStack>
                <SSVStack gap="xxs">
                  <SSText color="muted" center>
                    {t('account.nostrlabels.npub')}
                  </SSText>
                  <SSText
                    center
                    size="xl"
                    type="mono"
                    style={{ letterSpacing: 1 }}
                  >
                    {npub}
                  </SSText>
                </SSVStack>
              </SSVStack>
            )}
          </SSVStack>

          {/* Passphrase field - moved here */}
          <SSVStack gap="sm" style={{ paddingHorizontal: 20 }}>
            <SSText center>
              {t('account.nostrlabels.mnemonicPassphrase')}
            </SSText>
            <SSTextInput
              placeholder="Enter passphrase"
              value={passphrase}
              onChangeText={(text) => {
                setPassphrase(text)
                setRelayError(null)
                // Clear messages when passphrase changes
                setMessages([])
                setLastMessageTimestamp(null)
                setHasMoreMessages(true)
                if (account) {
                  updateAccount({
                    ...account,
                    nostrPassphrase: text
                  })
                }
              }}
              secureTextEntry
            />
          </SSVStack>

          {/* Top section with relay selection */}
          <SSVStack gap="md" style={{ padding: 20 }}>
            {selectedRelays.length === 0 && (
              <SSVStack gap="sm">
                <SSText color="white" weight="bold" center>
                  {t('account.nostrlabels.noRelaysWarning')}
                </SSText>
              </SSVStack>
            )}

            <SSButton
              variant={selectedRelays.length === 0 ? 'secondary' : 'outline'}
              label={`${t('account.nostrlabels.relays')} (${selectedRelays.length})`}
              onPress={() => {
                router.push({
                  pathname: `/account/${currentAccountId}/settings/nostr/selectRelays`
                })
              }}
            />
          </SSVStack>

          {/* Combined content */}
          <SSVStack gap="md" style={{ padding: 20 }}>
            {/* Message controls */}
            {npub && (
              <>
                <SSButton
                  label={t('account.nostrlabels.checkForMessages')}
                  onPress={(_event) => {
                    void fetchMessages(false)
                  }}
                  disabled={isLoading || selectedRelays.length === 0}
                />
                <SSButton
                  label={t('account.nostrlabels.sendLabels')}
                  onPress={handleSendMessage}
                  disabled={selectedRelays.length === 0}
                />
              </>
            )}

            {/* Auto-sync section */}
            <SSVStack gap="sm">
              <SSHStack gap="md" style={{ marginBottom: 10 }}>
                <SSCheckbox
                  label={t('account.nostrlabels.autoSync')}
                  selected={autoSync}
                  onPress={() => {
                    const newAutoSync = !autoSync
                    setAutoSync(newAutoSync)
                    setRelayError(null)
                    if (account) {
                      updateAccount({
                        ...account,
                        nostrLabelsAutoSync: newAutoSync
                      })
                      // Fetch messages immediately when auto-sync is enabled
                      if (newAutoSync && npub && selectedRelays.length > 0) {
                        fetchMessages()
                      } else if (newAutoSync && selectedRelays.length === 0) {
                        setRelayError(t('account.nostrlabels.noRelaysWarning'))
                      }
                    }
                  }}
                />
                {autoSync && (
                  <SSText size="sm" color="muted">
                    Syncing everytime a label is added or edited
                  </SSText>
                )}
              </SSHStack>

              {autoSync && (
                <SSButton
                  label="Sync now"
                  variant="secondary"
                  onPress={handleSendMessage}
                  disabled={isLoading || !npub || selectedRelays.length === 0}
                />
              )}
            </SSVStack>

            {/* Messages section */}
            {messages.length > 0 && (
              <SSVStack gap="md" style={{ marginTop: 20 }}>
                <SSHStack gap="md" justifyBetween>
                  <SSText>{t('account.nostrlabels.latestMessages')}</SSText>
                  {isLoading && (
                    <SSText color="muted">
                      {t('account.nostrlabels.loading')}
                    </SSText>
                  )}
                </SSHStack>
                {messages.map((msg, index) => (
                  <SSVStack
                    key={index}
                    gap="sm"
                    style={{
                      backgroundColor: '#1a1a1a',
                      padding: 10,
                      borderRadius: 8
                    }}
                  >
                    <SSText size="sm" color="muted">
                      {new Date(msg.created_at * 1000).toLocaleString()}
                    </SSText>
                    <SSText color={msg.isSender ? 'white' : 'muted'}>
                      {msg.isSender ? 'Content Sent' : 'Content Received'}:
                    </SSText>
                    {formatMessageContent(msg.decryptedContent, index)}
                    {msg.decryptedContent.startsWith('{"label":') && (
                      <SSButton
                        label={t('account.nostrlabels.importLabels')}
                        variant="outline"
                        onPress={() => {
                          handleImportLabels(msg.decryptedContent)
                        }}
                      />
                    )}
                  </SSVStack>
                ))}
                {hasMoreMessages && (
                  <SSButton
                    label={t('account.nostrlabels.loadOlderMessages')}
                    variant="gradient"
                    onPress={(_event) => {
                      void fetchMessages(true)
                    }}
                    disabled={isLoading}
                  />
                )}
              </SSVStack>
            )}

            {relayError && <SSText size="sm">{relayError}</SSText>}
          </SSVStack>
        </SSVStack>
      </ScrollView>

      <SSModal
        visible={successMsgVisible}
        onClose={() => setSuccessMsgVisible(false)}
      >
        <SSVStack
          gap="lg"
          style={{ justifyContent: 'center', height: '100%', width: '100%' }}
        >
          <SSText uppercase size="md" center weight="bold">
            {t('import.success', { importCount, total: importCountTotal })}
          </SSText>
          <SSButton
            label={t('common.close')}
            onPress={() => setSuccessMsgVisible(false)}
          />
        </SSVStack>
      </SSModal>
    </SSVStack>
  )
}
