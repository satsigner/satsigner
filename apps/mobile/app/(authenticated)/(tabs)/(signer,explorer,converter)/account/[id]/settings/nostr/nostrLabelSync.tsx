import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { LabelsAPI } from '@/api/labels'
import { NostrAPI, type NostrMessage } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

function SSNostrLabelSync() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [nsec, setNsec] = useState('')
  const [npub, setNpub] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [selectedRelays, setSelectedRelays] = useState<string[]>([])
  const [messages, setMessages] = useState<NostrMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [secretNostrKey, setSecretNostrKey] = useState<Uint8Array | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<number[]>([])
  const [relayError, setRelayError] = useState<string | null>(null)
  const [autoSync, setAutoSync] = useState(false)
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<
    number | null
  >(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [importCount, setImportCount] = useState(0)
  const [importCountTotal, setImportCountTotal] = useState(0)
  const [successMsgVisible, setSuccessMsgVisible] = useState(false)
  const [nostrApi, setNostrApi] = useState<NostrAPI | null>(null)
  const [labelsApi] = useState(() => new LabelsAPI())

  const [account, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccount
    ])
  )

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
      setRelayError(
        error instanceof Error ? error.message : 'Failed to send message'
      )
    }
  }

  async function handleImportLabels(content: string) {
    try {
      const labels = labelsApi.parseLabels(content)
      const importCount = useAccountsStore
        .getState()
        .importLabels(accountId!, labels)
      setImportCount(importCount)
      setImportCountTotal(labels.length)
      setSuccessMsgVisible(true)
    } catch {
      setRelayError('Failed to import labels')
    }
  }

  // Add function to toggle message expansion
  function toggleMessageExpansion(index: number) {
    setExpandedMessages((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }

  function MessageContent(content: string, index: number) {
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

  function handlePassphraseChange(text: string) {
    setPassphrase(text)
    setRelayError(null)
    // Clear messages when passphrase changes
    setMessages([])
    setLastMessageTimestamp(null)
    setHasMoreMessages(true)
    if (account) {
      updateAccount({
        ...account,
        nostr: {
          ...account.nostr,
          passphrase: text
        }
      })
    }
  }

  function handleToggleAutoSync() {
    const newAutoSync = !autoSync
    setAutoSync(newAutoSync)
    setRelayError(null)
    if (account) {
      updateAccount({
        ...account,
        nostr: {
          ...account.nostr,
          autoSync: newAutoSync
        }
      })
      // Fetch messages immediately when auto-sync is enabled
      if (newAutoSync && npub && selectedRelays.length > 0) {
        fetchMessages()
      } else if (newAutoSync && selectedRelays.length === 0) {
        setRelayError(t('account.nostrlabels.noRelaysWarning'))
      }
    }
  }

  function hideSuccessMsg() {
    setSuccessMsgVisible(false)
  }

  function goToSelectRelaysPage() {
    router.push({
      pathname: `/account/${accountId}/settings/nostr/selectRelays`
    })
  }

  function reloadApi() {
    if (selectedRelays.length > 0) {
      const api = new NostrAPI(selectedRelays)
      setNostrApi(api)
      // Connect immediately
      api.connect().catch(() => {
        setRelayError('Failed to connect to relays')
      })
    }
  }

  function loadNostrAccountData() {
    if (!account) return

    // Load saved relays when component mounts
    setSelectedRelays(account.nostr.relays)
    setAutoSync(account.nostr.autoSync)

    // Load passphrase
    if (account.nostr.passphrase !== undefined) {
      setPassphrase(account.nostr.passphrase)
    }

    // Initialize NostrAPI when component mounts if relays are available
    if (account.nostr.relays.length > 0) {
      const api = new NostrAPI(account.nostr.relays)
      setNostrApi(api)
      // Connect immediately
      api.connect().catch(() => {
        setRelayError('Failed to connect to relays')
      })
    }
  }

  function handleFetchMessagesAutoSync() {
    if (autoSync && npub && selectedRelays.length > 0) {
      fetchMessages()
    }

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
  }

  function sendLabelsToRelays() {
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
  }

  function autoCreateNsec() {
    if (account && passphrase !== undefined && selectedRelays.length > 0) {
      setNostrApi(new NostrAPI(selectedRelays))
      handleCreateNsec()
    }
  }

  useEffect(reloadApi, [selectedRelays])
  useEffect(loadNostrAccountData, [account])
  useEffect(autoCreateNsec, [account, passphrase, selectedRelays]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(handleFetchMessagesAutoSync, [autoSync, npub, selectedRelays]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(sendLabelsToRelays, [
    account,
    autoSync,
    nostrApi,
    npub,
    secretNostrKey,
    selectedRelays
  ])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (nostrApi) {
        nostrApi.disconnect()
      }
    }
  }, [nostrApi])

  if (!accountId || !account) return <Redirect href="/" />

  return (
    <SSMainLayout style={{ padding: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack gap="md">
          <SSText center uppercase color="muted">
            {t('account.nostrlabels.title')}
          </SSText>
          {/* Keys display */}
          <SSVStack gap="xxs" style={styles.keysContainer}>
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
                    style={styles.keyText}
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
                    style={styles.keyText}
                    selectable
                  >
                    {npub}
                  </SSText>
                </SSVStack>
              </SSVStack>
            )}
          </SSVStack>
          {/* Passphrase field */}
          <SSVStack gap="sm">
            <SSText center>
              {t('account.nostrlabels.mnemonicPassphrase')}
            </SSText>
            <SSTextInput
              placeholder="Enter passphrase"
              value={passphrase}
              onChangeText={handlePassphraseChange}
              secureTextEntry
            />
          </SSVStack>
          {/* Top section with relay selection */}
          <SSVStack gap="md">
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
              onPress={goToSelectRelaysPage}
            />
          </SSVStack>
          {/* Combined content */}
          <SSVStack gap="md">
            {/* Message controls */}
            {npub && (
              <>
                <SSButton
                  label={t('account.nostrlabels.checkForMessages')}
                  onPress={() => fetchMessages(false)}
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
              <SSHStack gap="md" style={styles.autoSyncContainer}>
                <SSCheckbox
                  label={t('account.nostrlabels.autoSync').toUpperCase()}
                  selected={autoSync}
                  onPress={handleToggleAutoSync}
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
              <SSVStack gap="md" style={styles.nostrMessageContainer}>
                <SSHStack gap="md" justifyBetween>
                  <SSText>{t('account.nostrlabels.latestMessages')}</SSText>
                  {isLoading && (
                    <SSText color="muted">
                      {t('account.nostrlabels.loading')}
                    </SSText>
                  )}
                </SSHStack>
                {messages.map((msg, index) => (
                  <SSVStack key={index} gap="sm" style={styles.nostrMessage}>
                    <SSText size="sm" color="muted">
                      {new Date(msg.created_at * 1000).toLocaleString()}
                    </SSText>
                    <SSText color={msg.isSender ? 'white' : 'muted'}>
                      {msg.isSender ? 'Content Sent' : 'Content Received'}:
                    </SSText>
                    {MessageContent(msg.decryptedContent || '', index)}
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
                    onPress={() => fetchMessages(true)}
                    disabled={isLoading}
                  />
                )}
              </SSVStack>
            )}

            {relayError && <SSText size="sm">{relayError}</SSText>}
          </SSVStack>
        </SSVStack>
      </ScrollView>
      <SSModal visible={successMsgVisible} onClose={hideSuccessMsg}>
        <SSVStack gap="lg" style={styles.modalSuccessMessageContainer}>
          <SSText uppercase size="md" center weight="bold">
            {t('import.success', { importCount, total: importCountTotal })}
          </SSText>
          <SSButton label={t('common.close')} onPress={hideSuccessMsg} />
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  modalSuccessMessageContainer: {
    justifyContent: 'center',
    height: '100%',
    width: '100%'
  },
  keysContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 190
  },
  keyText: {
    letterSpacing: 1
  },
  autoSyncContainer: {
    marginBottom: 10
  },
  nostrMessageContainer: {
    marginTop: 20
  },
  nostrMessage: {
    backgroundColor: '#1a1a1a',
    padding: 10,
    borderRadius: 8
  }
})

export default SSNostrLabelSync
