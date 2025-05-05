import { Redirect, router, useLocalSearchParams, Stack } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI, type NostrMessage, compressMessage } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import useNostrLabelSync from '@/hooks/useNostrLabelSync'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore, generateColorFromNpub } from '@/store/nostr'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import {
  formatAccountLabels,
  JSONLtoLabels,
  labelsToJSONL
} from '@/utils/bip329'

function SSNostrLabelSync() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const getMembers = useNostrStore((state) => state.getMembers)
  const members = accountId ? getMembers(accountId) : []
  const { processEvent } = useNostrLabelSync()
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())

  const [commonNsec, setCommonNsec] = useState('')
  const [commonNpub, setCommonNpub] = useState('')
  const [deviceNsec, setDeviceNsec] = useState('')
  const [deviceNpub, setDeviceNpub] = useState('')
  const [deviceColor, setDeviceColor] = useState('#404040')
  const [selectedRelays, setSelectedRelays] = useState<string[]>([])
  const [messages, setMessages] = useState<NostrMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<number[]>([])
  const [relayError, setRelayError] = useState<string | null>(null)
  const [autoSync, setAutoSync] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [importCount, setImportCount] = useState(0)
  const [importCountTotal, setImportCountTotal] = useState(0)
  const [successMsgVisible, setSuccessMsgVisible] = useState(false)
  const [nostrApi, setNostrApi] = useState<NostrAPI | null>(null)

  const { generateCommonNostrKeys } = useNostrLabelSync()

  const [account, updateAccountNostr] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccountNostr
    ])
  )

  // Initialize selectedMembers from account.trustedMemberDevices
  useEffect(() => {
    if (account?.nostr?.trustedMemberDevices) {
      setSelectedMembers(new Set(account.nostr.trustedMemberDevices))
    }
  }, [account?.nostr?.trustedMemberDevices])

  // Load common Nostr keys once when component mounts
  if (account && !commonNsec) {
    if (account.nostr.commonNsec && account.nostr.commonNpub) {
      setCommonNsec(account.nostr.commonNsec)
      setCommonNpub(account.nostr.commonNpub)
    } else {
      generateCommonNostrKeys(account)
        .then((keys) => {
          if (keys) {
            setCommonNsec(keys.commonNsec as string)
            setCommonNpub(keys.commonNpub as string)
            // Update account with common keys
            updateAccountNostr(accountId, {
              commonNsec: keys.commonNsec,
              commonNpub: keys.commonNpub
            })
          }
        })
        .catch((error) => {
          throw new Error(`Error loading common Nostr keys: ${error}`)
        })
    }
  }

  // Load device Nostr keys once when component mounts
  if (account && !deviceNsec) {
    if (account.nostr.deviceNsec && account.nostr.deviceNpub) {
      setDeviceNsec(account.nostr.deviceNsec)
      setDeviceNpub(account.nostr.deviceNpub)
      // Generate color for device
      generateColorFromNpub(account.nostr.deviceNpub).then(setDeviceColor)
    } else {
      NostrAPI.generateNostrKeys()
        .then((keys) => {
          if (keys) {
            setDeviceNsec(keys.nsec)
            setDeviceNpub(keys.npub)
            // Generate color for device
            generateColorFromNpub(keys.npub).then(setDeviceColor)
            // Only update device keys
            updateAccountNostr(accountId, {
              deviceNpub: keys.npub,
              deviceNsec: keys.nsec
            })
          }
        })
        .catch((error) => {
          throw new Error(`Error loading device Nostr keys: ${error}`)
        })
    }
  }

  // Generate device color when deviceNpub is available
  useEffect(() => {
    if (deviceNpub && deviceColor === '#404040') {
      generateColorFromNpub(deviceNpub).then(setDeviceColor)
    }
  }, [deviceNpub, deviceColor])

  function filterMessages(msg: NostrMessage) {
    return msg.decryptedContent !== undefined && msg.decryptedContent !== ''
  }

  async function fetchMessages(loadMore: boolean = false) {
    if (!commonNsec || !commonNpub || !nostrApi) {
      setRelayError(t('account.nostrSync.errorMissingData'))
      return
    }

    // Add relay check at the start
    if (selectedRelays.length === 0) {
      setRelayError(t('account.nostrSync.noRelaysWarning'))
      return
    }

    setIsLoading(true)
    try {
      const fetchedMessages = (
        await nostrApi.fetchMessages(commonNsec, commonNpub)
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
    } catch (error) {
      throw new Error(`Error fetching messages: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSendMessage() {
    if (!commonNsec || !commonNpub || !nostrApi || !account) {
      setRelayError(t('account.nostrSync.errorMissingData'))
      return
    }
    try {
      const labels = formatAccountLabels(account)

      if (labels.length === 0) {
        setRelayError(t('account.nostrSync.noLabelsToSync'))
        return
      }

      // Format each label entry and wrap in labelPackage
      const labelPackage = labels.map((label) => ({
        __class__: 'Label',
        VERSION: '0.0.3',
        type: label.type,
        ref: label.ref,
        label: label.label,
        spendable: label.spendable,
        timestamp: Math.floor(Date.now() / 1000)
      }))

      const labelPackageJSONL = labelsToJSONL(labelPackage)
      //console.log('🔵🔵🔵🔵🟢 Label package JSONL:', labelPackageJSONL)

      const messageContent = {
        created_at: Math.floor(Date.now() / 1000),
        label: 1,
        description: 'Here come some labels',
        data: { data: labelPackageJSONL, data_type: 'LabelsBip329' }
      }

      const compressedMessage = compressMessage(messageContent)

      const eventKind1059 = await nostrApi.createKind1059(
        commonNsec,
        commonNpub,
        compressedMessage
      )
      await nostrApi.publishEvent(eventKind1059)
      toast.success('Labels sent to relays')
      // Update last backup timestamp
      const timestamp = Math.floor(Date.now() / 1000)
      updateAccountNostr(accountId, {
        lastBackupTimestamp: timestamp
      })
    } catch (_error) {
      toast.error('Failed to send labels')
      setRelayError('Failed to send labels')
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
              {t('account.nostrSync.backupPreviewShowLess')}
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
          {t('account.nostrSync.backupPreviewShowMore')}
        </SSText>
      </SSVStack>
    )
  }

  async function handleToggleAutoSync() {
    const newAutoSync = !autoSync
    setAutoSync(newAutoSync)
    setRelayError(null)
    if (accountId) {
      updateAccountNostr(accountId, { autoSync: newAutoSync })

      // Send trust request to all devices
      if (!commonNsec || !commonNpub || !nostrApi) {
        setRelayError(t('account.nostrSync.errorMissingData'))
        return
      }
      try {
        const messageContent = JSON.stringify({
          created_at: Math.floor(Date.now() / 1000),
          public_key_bech32: deviceNpub
        })
        const compressedMessage = compressMessage(JSON.parse(messageContent))
        const eventKind1059 = await nostrApi.createKind1059(
          commonNsec,
          commonNpub,
          compressedMessage
        )
        await nostrApi.publishEvent(eventKind1059)
      } catch (_error) {
        setRelayError('Failed to send trust request')
      }

      // Send labels immediately when auto-sync is enabled
      if (newAutoSync && commonNpub && selectedRelays.length > 0) {
        handleSendMessage()
      } else if (newAutoSync && selectedRelays.length === 0) {
        setRelayError(t('account.nostrSync.noRelaysWarning'))
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

  function goToDevicesGroupChat() {
    router.push({
      pathname: `/account/${accountId}/settings/nostr/devicesGroupChat`
    })
  }

  function reloadApi() {
    if (selectedRelays.length > 0) {
      const api = new NostrAPI(selectedRelays)
      setNostrApi(api)
      // Only connect if auto-sync is enabled
      if (autoSync) {
        api.connect().catch(() => {
          setRelayError('Failed to connect to relays')
        })

        // Subscribe to kind 1059 messages
        if (deviceNsec && commonNsec) {
          api
            .subscribeToKind1059(
              commonNsec,
              deviceNsec,
              async (message) => {
                if (message.content && account) {
                  try {
                    const eventContent = await processEvent(
                      account,
                      message.content
                    )
                    let parsedContent
                    try {
                      parsedContent = JSON.parse(eventContent)
                    } catch {
                      parsedContent = eventContent
                    }

                    if (parsedContent.public_key_bech32) {
                      // This is a trust request
                      console.log(
                        'Received trust request:',
                        parsedContent.public_key_bech32
                      )
                      const addMember = useNostrStore.getState().addMember
                      await addMember(
                        accountId,
                        parsedContent.public_key_bech32
                      )
                    }
                    setMessages((prev) => [message, ...prev])
                  } catch (error) {
                    console.error('Error processing message:', error)
                  }
                }
              },
              undefined,
              Math.floor(Date.now() / 1000) // Only get messages from now onwards
            )
            .catch(() => {
              setRelayError('Failed to subscribe to kind 1059 messages')
            })
        }
      }
    }
  }

  function loadNostrAccountData() {
    if (!account) return

    // Load saved relays when component mounts
    setSelectedRelays(account.nostr.relays)
    setAutoSync(account.nostr.autoSync)

    // Initialize NostrAPI when component mounts if relays are available and auto-sync is enabled
    if (account.nostr.relays.length > 0 && account.nostr.autoSync) {
      const api = new NostrAPI(account.nostr.relays)
      setNostrApi(api)
      // Connect immediately
      api.connect().catch(() => {
        setRelayError('Failed to connect to relays')
      })
    }
  }

  function handleFetchMessagesAutoSync() {
    if (autoSync && commonNpub && selectedRelays.length > 0) {
      fetchMessages()
    }

    if (autoSync && commonNpub && selectedRelays.length > 0) {
      // Set up interval for auto sync
      const syncInterval = setInterval(() => {
        fetchMessages()
      }, 60000) // Sync every minute

      // Cleanup interval on unmount or when auto sync is disabled
      return () => clearInterval(syncInterval)
    }
  }

  const toggleMember = (npub: string) => {
    setSelectedMembers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(npub)) {
        newSet.delete(npub)
        // Remove from trustedMemberDevices in account store
        if (account) {
          updateAccountNostr(accountId, {
            trustedMemberDevices: account.nostr.trustedMemberDevices.filter(
              (m) => m !== npub
            )
          })
        }
      } else {
        newSet.add(npub)
        // Add to trustedMemberDevices in account store
        if (account) {
          updateAccountNostr(accountId, {
            trustedMemberDevices: [...account.nostr.trustedMemberDevices, npub]
          })
        }
      }
      return newSet
    })
  }

  useEffect(reloadApi, [
    selectedRelays,
    commonNpub,
    commonNsec,
    deviceNpub,
    deviceNsec,
    account,
    accountId,
    processEvent,
    autoSync
  ])
  useEffect(loadNostrAccountData, [account])
  useEffect(handleFetchMessagesAutoSync, [autoSync, commonNpub, selectedRelays]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <SSMainLayout style={{ paddingTop: 10, paddingBottom: 20 }}>
      <ScrollView>
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
        <SSVStack gap="lg">
          <SSText center uppercase color="muted">
            {t('account.nostrSync.title')}
          </SSText>

          {/* Auto-sync section */}
          <SSVStack gap="md">
            <SSButton
              variant={autoSync ? 'danger' : 'secondary'}
              label={autoSync ? 'Turn sync OFF' : 'Turn sync ON'}
              onPress={handleToggleAutoSync}
            />
            <SSHStack gap="md">
              <SSButton
                style={{ flex: 0.9 }}
                variant="outline"
                label={t('account.nostrSync.setKeys')}
                onPress={goToNostrKeyPage}
              />

              <SSButton
                style={{ flex: 0.9 }}
                variant={selectedRelays.length === 0 ? 'secondary' : 'outline'}
                label={t('account.nostrSync.manageRelays', {
                  count: selectedRelays.length
                })}
                onPress={goToSelectRelaysPage}
              />
            </SSHStack>

            {selectedRelays.length === 0 && (
              <SSText color="white" weight="bold" center>
                {t('account.nostrSync.noRelaysWarning')}
              </SSText>
            )}

            {/* Personal Device Keys */}
            <SSVStack gap="sm">
              <SSText center>{t('account.nostrSync.deviceKeys')}</SSText>
              <SSVStack gap="xxs" style={styles.keysContainer}>
                {deviceNsec !== '' && deviceNpub !== '' ? (
                  <>
                    <SSVStack gap="xxs">
                      <SSText color="muted" center>
                        {t('account.nostrSync.nsec')}
                      </SSText>
                      <SSTextClipboard text={deviceNsec}>
                        <SSText
                          center
                          size="xl"
                          type="mono"
                          style={styles.keyText}
                          selectable
                        >
                          {deviceNsec.slice(0, 12) +
                            '...' +
                            deviceNsec.slice(-4)}
                        </SSText>
                      </SSTextClipboard>
                    </SSVStack>
                    <SSVStack gap="xxs">
                      <SSText color="muted" center>
                        {t('account.nostrSync.npub')}
                      </SSText>

                      <SSHStack gap="xxs" style={{ flex: 0.7 }}>
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: deviceColor,
                            marginTop: 1,
                            marginLeft: 60,
                            marginRight: -60
                          }}
                        />
                        <SSTextClipboard text={deviceNpub}>
                          <SSText
                            center
                            size="xl"
                            type="mono"
                            style={styles.keyText}
                            selectable
                          >
                            {deviceNpub.slice(0, 12) +
                              '...' +
                              deviceNpub.slice(-4)}
                          </SSText>
                        </SSTextClipboard>
                      </SSHStack>
                    </SSVStack>
                  </>
                ) : (
                  <SSHStack style={styles.keyContainerLoading}>
                    <ActivityIndicator />
                    <SSText uppercase>
                      {t('account.nostrSync.loadingKeys')}
                    </SSText>
                  </SSHStack>
                )}
              </SSVStack>
            </SSVStack>

            <SSButton
              style={{ marginTop: 30, marginBottom: 10 }}
              variant="outline"
              label={t('account.nostrSync.devicesGroupChat')}
              onPress={goToDevicesGroupChat}
            />

            {/* Members section */}
            <SSVStack gap="sm">
              <SSText center color="muted">
                {t('account.nostrSync.members')}
              </SSText>
              {members.length > 0 ? (
                <SSVStack gap="md" style={styles.membersContainer}>
                  {members
                    .filter((member) => member.npub !== deviceNpub)
                    .map((member, index) => (
                      <SSVStack key={index} gap="md">
                        {member?.npub && (
                          <SSHStack gap="md">
                            <SSHStack gap="xxs" style={{ flex: 0.7 }}>
                              <View
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 4,
                                  backgroundColor: member.color,
                                  marginTop: 1,
                                  marginLeft: 20,
                                  marginRight: -20
                                }}
                              />
                              <SSTextClipboard text={member.npub}>
                                <SSText
                                  center
                                  size="xl"
                                  type="mono"
                                  style={styles.memberText}
                                  selectable
                                >
                                  {member.npub.slice(0, 12) +
                                    '...' +
                                    member.npub.slice(-4)}
                                </SSText>
                              </SSTextClipboard>
                            </SSHStack>
                            <SSButton
                              style={{
                                height: 44,
                                flex: 0.25
                              }}
                              variant={
                                selectedMembers.has(member.npub)
                                  ? 'danger'
                                  : 'outline'
                              }
                              label={
                                selectedMembers.has(member.npub)
                                  ? 'Distrust'
                                  : 'Trust'
                              }
                              onPress={() => toggleMember(member.npub)}
                            />
                          </SSHStack>
                        )}
                      </SSVStack>
                    ))}
                </SSVStack>
              ) : (
                <SSText center color="muted">
                  {t('account.nostrSync.noMembers')}
                </SSText>
              )}
            </SSVStack>
          </SSVStack>

          <SSVStack gap="sm">
            {/* Message controls */}
            {commonNpub && <></>}
            {/* Messages section */}
            {messages.length > 0 && (
              <SSVStack gap="md" style={styles.nostrMessageContainer}>
                <SSHStack gap="md" justifyBetween>
                  <SSText>{t('account.nostrSync.latestMessages')}</SSText>
                  {isLoading && (
                    <SSText color="muted">
                      {t('account.nostrSync.loading')}
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
                    {MessageContent(msg.content.content || '', index)}
                    {msg.content.content?.startsWith('{"label":') && (
                      <SSButton
                        label={t('account.nostrSync.importLabels')}
                        variant="outline"
                        onPress={() => {
                          handleImportLabels(msg.content.content || '')
                        }}
                      />
                    )}
                  </SSVStack>
                ))}
                {hasMoreMessages && (
                  <SSButton
                    label={t('account.nostrSync.loadOlderMessages')}
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
    padding: 10,
    paddingBottom: 30,
    paddingHorizontal: 28
  },
  membersContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderColor: Colors.white,
    paddingVertical: 15,
    paddingHorizontal: 0
  },
  colorCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4
  },
  memberText: {
    letterSpacing: 1,
    color: Colors.white
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
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.white,
    borderRadius: 4,
    marginRight: 8,
    marginTop: 1
  },
  checkboxSelected: {
    backgroundColor: Colors.white
  }
})

export default SSNostrLabelSync
