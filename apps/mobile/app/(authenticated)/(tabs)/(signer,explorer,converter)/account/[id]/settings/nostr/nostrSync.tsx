import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI, compressMessage } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import useNostrSync from '@/hooks/useNostrSync'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore, generateColorFromNpub } from '@/store/nostr'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAccountLabels, labelsToJSONL } from '@/utils/bip329'
import { Account } from '@/types/models/Account'

function SSNostrSync() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const clearNostrState = useNostrStore((state) => state.clearNostrState)
  const clearProcessedMessageIds = useNostrStore(
    (state) => state.clearProcessedMessageIds
  )
  const clearProcessedEvents = useNostrStore(
    (state) => state.clearProcessedEvents
  )
  const members = useNostrStore(
    useShallow((state) => {
      const accountMembers = state.members[accountId || ''] || []
      return accountMembers
        .map((member) =>
          typeof member === 'string'
            ? { npub: member, color: '#404040' }
            : member
        )
        .reduce(
          (acc, member) => {
            if (!acc.some((m) => m.npub === member.npub)) {
              acc.push(member)
            }
            return acc
          },
          [] as { npub: string; color: string }[]
        )
    })
  )
  const { processEvent, clearStoredDMs } = useNostrSync()
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const hasRefreshed = useRef(false)
  const [isLoading, setIsLoading] = useState(false)

  const [commonNsec, setCommonNsec] = useState('')
  const [commonNpub, setCommonNpub] = useState('')
  const [deviceNsec, setDeviceNsec] = useState('')
  const [deviceNpub, setDeviceNpub] = useState('')
  const [deviceColor, setDeviceColor] = useState('#404040')
  const [selectedRelays, setSelectedRelays] = useState<string[]>([])
  const [autoSync, setAutoSync] = useState(false)
  const [nostrApi, setNostrApi] = useState<NostrAPI | null>(null)

  const {
    generateCommonNostrKeys,
    sendLabelsToNostr,
    dataExchangeSubscription,
    protocolSubscription
  } = useNostrSync()

  const [account, updateAccountNostr] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccountNostr
    ])
  )

  async function handleClearNostrStore() {
    if (!accountId) return

    try {
      setIsLoading(true)
      console.log(
        '🧹 Before Clear - Nostr Store State:',
        useNostrStore.getState().members
      )

      // Clear all members for the current account
      clearNostrState(accountId)

      // Clear processed message IDs
      clearProcessedMessageIds(accountId)

      // Clear processed events
      clearProcessedEvents(accountId)

      // Wait for the next tick to ensure state updates are processed
      await new Promise((resolve) => setTimeout(resolve, 100))

      console.log(
        '🧹 After Clear - Nostr Store State:',
        useNostrStore.getState().members
      )

      // Force a re-render by updating a state
      setSelectedMembers(new Set())

      toast.success('Nostr store cleared successfully')
    } catch (error) {
      console.error('Error clearing Nostr store:', error)
      toast.error('Failed to clear Nostr store')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearMessages = async () => {
    if (!accountId || !account) return

    try {
      setIsLoading(true)
      await clearStoredDMs(account)
      clearProcessedMessageIds(accountId)
      toast.success('Messages cleared successfully')
    } catch {
      toast.error('Failed to clear messages')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshAccountLabels = useCallback(async () => {
    if (!account || hasRefreshed.current) return
    hasRefreshed.current = true
    if (autoSync) {
      //dataExchangeSubscription(account)
      protocolSubscription(account)
    }
  }, [account, dataExchangeSubscription, autoSync, protocolSubscription])

  // Update selectedMembers when members change
  useEffect(() => {
    if (account?.nostr?.trustedMemberDevices) {
      setSelectedMembers(new Set(account.nostr.trustedMemberDevices))
    }
  }, [members, account?.nostr?.trustedMemberDevices])

  // Refresh account labels on mount
  useEffect(() => {
    refreshAccountLabels()
  }, [account, refreshAccountLabels])

  // Load common Nostr keys once when component mounts
  useEffect(() => {
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
  }, [
    account,
    accountId,
    generateCommonNostrKeys,
    updateAccountNostr,
    commonNsec
  ])

  // Load device Nostr keys once when component mounts
  useEffect(() => {
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
  }, [account, accountId, generateColorFromNpub, updateAccountNostr])

  // Generate device color when deviceNpub is available
  useEffect(() => {
    if (deviceNpub && deviceColor === '#404040') {
      generateColorFromNpub(deviceNpub).then(setDeviceColor)
    }
  }, [deviceNpub, deviceColor])

  // Debug log when members change
  useEffect(() => {
    console.log('🔄 Members Updated:', members)
  }, [members])

  async function handleToggleAutoSync(account: Account) {
    const newAutoSync = !autoSync
    setAutoSync(newAutoSync)

    if (accountId) {
      updateAccountNostr(accountId, { autoSync: newAutoSync })

      // If auto-sync is enabled, send trust request to all devices
      if (newAutoSync) {
        // Send trust request to all devices
        try {
          if (!nostrApi) {
            toast.error('Nostr API not initialized')
            return
          }
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

          console.log('🙏 send trust request 🙏', messageContent)
          await nostrApi.publishEvent(eventKind1059)
        } catch (_error) {
          toast.error('Failed to send trust request')
        }

        // Send all labels to all devices
        if (!account) {
          toast.error(t('account.nostrSync.errorMissingData'))

          return
        }
        //dataExchangeSubscription(account)
        protocolSubscription(account)
      }
    }
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
          toast.info('Checking connection')
        })
        protocolSubscription(account)
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
        protocolSubscription(account)
      })
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
              onPress={() => handleToggleAutoSync(account)}
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

            <SSHStack gap="md">
              <SSButton
                label="Clear Nostr Store"
                onPress={handleClearNostrStore}
                variant="subtle"
                style={{ flex: 0.5 }}
                disabled={isLoading}
              />
              <SSButton
                label="Clear All Messages"
                onPress={handleClearMessages}
                disabled={isLoading}
                variant="subtle"
                style={{ flex: 0.5 }}
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
              <SSText center>{t('account.nostrSync.members')}</SSText>
              {members && members.length > 0 ? (
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
                                  backgroundColor: member.color || '#404040',
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
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
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
  }
})

export default SSNostrSync
