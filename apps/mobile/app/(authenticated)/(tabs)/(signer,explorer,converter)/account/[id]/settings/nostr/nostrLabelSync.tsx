import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI, type NostrMessage } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import useNostrLabelSync from '@/hooks/useNostrLabelSync'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { JSONLtoLabels } from '@/utils/bip329'

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
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [importCount, setImportCount] = useState(0)
  const [importCountTotal, setImportCountTotal] = useState(0)
  const [successMsgVisible, setSuccessMsgVisible] = useState(false)
  const [nostrApi, setNostrApi] = useState<NostrAPI | null>(null)

  const { sendAccountLabelsToNostr, generateAccountNostrKeys } =
    useNostrLabelSync()

  const [account, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccount
    ])
  )

  function filterMessages(msg: NostrMessage) {
    return msg.decryptedContent !== undefined && msg.decryptedContent !== ''
  }

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

      const lastBackupTimestamp = account?.nostr.lastBackupTimestamp

      const fetchedMessages = (
        await nostrApi.fetchMessages(
          Uint8Array.from(secretNostrKey),
          npub,
          lastBackupTimestamp
        )
      ).filter(filterMessages)

      // If no messages returned, we've reached the end
      if (fetchedMessages.length === 0) {
        setHasMoreMessages(false)
        setIsLoading(false)
        return
      }

      // Update messages state based on whether we're loading more or not
      if (loadMore) {
        setMessages((prev) => [...prev, ...fetchedMessages])
      } else {
        setMessages(fetchedMessages)
      }
    } catch {
      setRelayError(t('account.nostrLabels.errorLabelFetching'))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateNsec() {
    if (!account) return

    const { npub, nsec, seckey } = account.nostr
    if (npub && nsec && seckey) {
      setSecretNostrKey(seckey)
      setNsec(nsec)
      setNpub(npub)
      return
    }

    try {
      const keys = await generateAccountNostrKeys(account, passphrase)
      setSecretNostrKey(keys.secretNostrKey)
      setNsec(keys.nsec)
      setNpub(keys.npub)
      updateAccount({
        ...account,
        nostr: {
          ...account.nostr,
          seckey: keys.secretNostrKey,
          npub: keys.npub,
          nsec: keys.nsec
        }
      })
    } catch {
      setRelayError(t('account.nostrLabels.errorNsec'))
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
      sendAccountLabelsToNostr(account)
    } catch {
      setRelayError(t('account.nostrLabels.errorLabelSend'))
    }
  }

  async function handleImportLabels(content: string) {
    try {
      const labels = JSONLtoLabels(content)
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
    const characterLimit = 200

    if (content.length <= characterLimit || expandedMessages.includes(index)) {
      return (
        <SSVStack gap="xxs">
          <SSText style={{ fontFamily: 'System' }}>{content}</SSText>
          {content.length > characterLimit && (
            <SSText
              color="white"
              onPress={() => toggleMessageExpansion(index)}
              style={{ textDecorationLine: 'underline' }}
            >
              {t('account.nostrLabels.backupPreviewShowLess')}
            </SSText>
          )}
        </SSVStack>
      )
    }

    return (
      <SSVStack gap="xxs">
        <SSText style={{ fontFamily: 'System' }}>
          {content.slice(0, characterLimit)}...
        </SSText>
        <SSText
          color="white"
          onPress={() => toggleMessageExpansion(index)}
          style={{ textDecorationLine: 'underline' }}
        >
          {t('account.nostrLabels.backupPreviewShowMore')}
        </SSText>
      </SSVStack>
    )
  }

  function handlePassphraseChange(text: string) {
    setPassphrase(text)
    setRelayError(null)
    // Clear messages when passphrase changes
    setMessages([])
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

  function goToNostrKeyPage() {
    router.push({
      pathname: `/account/${accountId}/settings/nostr/nostrKey`
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

  function sendLabelsToNostr() {
    sendAccountLabelsToNostr(account)
  }

  function autoCreateNsec() {
    if (account && passphrase !== undefined) {
      setNostrApi(new NostrAPI(selectedRelays))
      handleCreateNsec()
    }
  }

  useEffect(reloadApi, [selectedRelays])
  useEffect(loadNostrAccountData, [account])
  useEffect(sendLabelsToNostr, [account]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(autoCreateNsec, [account, passphrase, selectedRelays]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(handleFetchMessagesAutoSync, [autoSync, npub, selectedRelays]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <SSMainLayout style={{ paddingTop: 0, paddingBottom: 20 }}>
      <ScrollView>
        <SSVStack gap="lg">
          <SSText center uppercase color="muted">
            {t('account.nostrlabels.title')}
          </SSText>
          {/* Keys display */}
          <SSVStack gap="sm">
            <SSVStack gap="xxs" style={styles.keysContainer}>
              {nsec !== '' && npub !== '' ? (
                <>
                  <SSVStack gap="xxs">
                    <SSText color="muted" center>
                      {t('account.nostrlabels.nsec')}
                    </SSText>
                    <SSTextClipboard text={nsec}>
                      <SSText
                        center
                        size="xl"
                        type="mono"
                        style={styles.keyText}
                        selectable
                      >
                        {nsec}
                      </SSText>
                    </SSTextClipboard>
                  </SSVStack>
                  <SSVStack gap="xxs">
                    <SSText color="muted" center>
                      {t('account.nostrlabels.npub')}
                    </SSText>
                    <SSTextClipboard text={npub}>
                      <SSText
                        center
                        size="xl"
                        type="mono"
                        style={styles.keyText}
                        selectable
                      >
                        {npub}
                      </SSText>
                    </SSTextClipboard>
                  </SSVStack>
                </>
              ) : (
                <SSHStack style={styles.keyContainerLoading}>
                  <ActivityIndicator />
                  <SSText uppercase>
                    {t('account.nostrlabels.loadingKeys')}
                  </SSText>
                </SSHStack>
              )}
            </SSVStack>
            <SSButton
              variant="subtle"
              label={t('account.nostrlabels.setKeys')}
              onPress={goToNostrKeyPage}
            />
          </SSVStack>
          {/* Passphrase field */}
          <SSVStack gap="xs">
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
          <SSVStack gap="sm">
            {/* Top section with relay selection */}
            <SSVStack gap="sm">
              {selectedRelays.length === 0 && (
                <SSText color="white" weight="bold" center>
                  {t('account.nostrlabels.noRelaysWarning')}
                </SSText>
              )}
              <SSButton
                variant={selectedRelays.length === 0 ? 'secondary' : 'outline'}
                label={t('account.nostrlabels.manageRelays', {
                  count: selectedRelays.length
                })}
                onPress={goToSelectRelaysPage}
              />
            </SSVStack>
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
    borderColor: Colors.white,
    padding: 10
  },
  keyContainerLoading: {
    justifyContent: 'center',
    paddingVertical: 10
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
