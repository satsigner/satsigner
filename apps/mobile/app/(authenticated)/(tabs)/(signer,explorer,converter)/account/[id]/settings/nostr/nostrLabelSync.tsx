import { Redirect, Stack, useLocalSearchParams, router } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'
import { useState, useEffect } from 'react'
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
import { NostrAPI, type NostrKeys, type NostrMessage } from '@/api/nostr'
import { LabelsAPI } from '@/api/labels'

export default function NostrSettings() {
  const { id: currentAccountId } = useLocalSearchParams<AccountSearchParams>()
  const [nsec, setNsec] = useState('')
  const [npub, setNpub] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [selectedRelays, setSelectedRelays] = useState<string[]>([])
  const [messages, setMessages] = useState<NostrMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [secretNostrKey, setSecretNostrKey] = useState<Uint8Array | null>(null)
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
  const [nostrApi, setNostrApi] = useState<NostrAPI | null>(null)
  const [labelsApi] = useState(() => new LabelsAPI())

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

  // Initialize NostrAPI when relays change
  useEffect(() => {
    if (selectedRelays.length > 0) {
      const api = new NostrAPI(selectedRelays)
      setNostrApi(api)
      // Connect immediately
      api.connect().catch((error) => {
        console.error('Failed to connect to relays:', error)
        setRelayError('Failed to connect to relays')
      })
    }
  }, [selectedRelays])

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
        fetchMessages()
      }, 60000) // Sync every minute

      // Cleanup interval on unmount or when auto sync is disabled
      return () => clearInterval(syncInterval)
    }
  }, [autoSync, npub, selectedRelays])

  // Add effect to handle label updates
  useEffect(() => {
    if (
      autoSync &&
      npub &&
      selectedRelays.length > 0 &&
      secretNostrKey &&
      account &&
      nostrApi
    ) {
      nostrApi.sendLabelsToNostr(secretNostrKey, npub, account)
    }
  }, [account?.transactions, account?.utxos, account?.addresses])

  // Add new useEffect to auto-execute handleCreateNsec
  useEffect(() => {
    if (account && passphrase !== undefined && selectedRelays.length > 0) {
      setNostrApi(new NostrAPI(selectedRelays))
      handleCreateNsec()
    }
  }, [account, passphrase, selectedRelays])

  async function fetchMessages(loadMore: boolean = false) {
    if (!npub || !secretNostrKey || !nostrApi) return

    // Add relay check at the start
    if (selectedRelays.length === 0) {
      setRelayError(t('account.nostrlabels.noRelaysWarning'))
      return
    }

    setIsLoading(true)
    try {
      // Ensure connection is established
      await nostrApi.connect()

      const fetchedMessages = await nostrApi.fetchMessages(
        secretNostrKey,
        npub,
        loadMore ? lastMessageTimestamp ?? undefined : undefined
      )

      // If no messages returned, we've reached the end
      if (fetchedMessages.length === 0) {
        setHasMoreMessages(false)
        setIsLoading(false)
        return
      }

      // Update last message timestamp for pagination
      if (fetchedMessages.length > 0) {
        setLastMessageTimestamp(
          fetchedMessages[fetchedMessages.length - 1].created_at
        )
      }

      // Update messages state based on whether we're loading more or not
      if (loadMore) {
        setMessages((prev) => [...prev, ...fetchedMessages])
      } else {
        setMessages(fetchedMessages)
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
      if (!account || !nostrApi) {
        throw new Error('Nostr API not initialized')
      }

      const keys = await nostrApi.createNsec(account, passphrase)
      setSecretNostrKey(keys.secretNostrKey)
      setNsec(keys.nsec)
      setNpub(keys.npub)
    } catch (error) {
      console.error('Error creating nsec:', error)
      setRelayError(
        error instanceof Error ? error.message : 'Failed to create nsec'
      )
    }
  }

  async function handleSendMessage() {
    if (!secretNostrKey || !npub || !account || !nostrApi) return

    // Add relay check at the start
    if (selectedRelays.length === 0) {
      setRelayError(t('account.nostrlabels.noRelaysWarning'))
      return
    }

    try {
      // Ensure connection is established
      await nostrApi.connect()

      // Format labels using the API
      const labels = labelsApi.formatLabels(account)

      // Create message content with labels in JSONL format using the API
      const messageContent = labelsApi.exportLabels(labels)

      // Send message using the API
      await nostrApi.sendMessage(secretNostrKey, npub, messageContent)

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
          <SSText style={{ fontFamily: 'System' }}>{content}</SSText>
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
        <SSText style={{ fontFamily: 'System' }}>
          {content.slice(0, 200)}...
        </SSText>
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

  const handleImportLabels = async (content: string) => {
    try {
      const labels = labelsApi.parseLabels(content)
      const importCount = useAccountsStore
        .getState()
        .importLabels(currentAccountId!, labels)
      setImportCount(importCount)
      setImportCountTotal(labels.length)
      setSuccessMsgVisible(true)
    } catch (error) {
      console.error('Error importing labels:', error)
      setRelayError('Failed to import labels')
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (nostrApi) {
        nostrApi.disconnect()
      }
    }
  }, [nostrApi])

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

          {/* Keys display */}
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
                    selectable
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
                    selectable
                  >
                    {npub}
                  </SSText>
                </SSVStack>
              </SSVStack>
            )}
          </SSVStack>

          {/* Passphrase field */}
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
                    {formatMessageContent(msg.decryptedContent || '', index)}
                    {msg.decryptedContent?.startsWith('{"label":') && (
                      <SSButton
                        label={t('account.nostrlabels.importLabels')}
                        variant="outline"
                        onPress={() => {
                          handleImportLabels(msg.decryptedContent || '')
                        }}
                      />
                    )}
                  </SSVStack>
                ))}
                {hasMoreMessages && (
                  <SSButton
                    label={t('account.nostrlabels.loadOlderMessages')}
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
