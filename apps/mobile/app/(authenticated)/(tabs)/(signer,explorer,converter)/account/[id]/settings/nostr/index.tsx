import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI, compressMessage } from '@/api/nostr'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import SSButton from '@/components/SSButton'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import useNostrSync from '@/hooks/useNostrSync'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { Colors } from '@/styles'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { generateColorFromNpub } from '@/utils/nostr'

function NostrSync() {
  // Account and store hooks
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const [account, updateAccountNostr] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccountNostr
    ])
  )

  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false)

  const [keysGenerated, setKeysGenerated] = useState(false)

  const updateAccountNostrCallback = useCallback(
    (accountId: string, nostrData: any) => {
      updateAccountNostr(accountId, nostrData)
    },
    [updateAccountNostr]
  )

  // Nostr store actions
  const clearNostrState = useNostrStore((state) => state.clearNostrState)
  const clearProcessedMessageIds = useNostrStore(
    (state) => state.clearProcessedMessageIds
  )
  const clearProcessedEvents = useNostrStore(
    (state) => state.clearProcessedEvents
  )

  // Members management
  const members = useNostrStore(
    useShallow((state) => {
      if (!accountId) return []
      const accountMembers = state.members[accountId] || []
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

  // Nostr sync hooks
  const {
    clearStoredDMs,
    generateCommonNostrKeys,
    deviceAnnouncement,
    cleanupSubscriptions,
    nostrSyncSubscriptions
  } = useNostrSync()

  // State management
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [commonNsec, setCommonNsec] = useState('')
  const [deviceNsec, setDeviceNsec] = useState('')
  const [deviceNpub, setDeviceNpub] = useState('')
  const [deviceColor, setDeviceColor] = useState('#404040')
  const [selectedRelays, setSelectedRelays] = useState<string[]>([])
  const [relayConnectionStatuses, setRelayConnectionStatuses] = useState<
    Record<string, 'connected' | 'connecting' | 'disconnected'>
  >({})

  // Add this useCallback near the top of the component, after other hooks
  const getUpdatedAccount = useCallback(() => {
    return useAccountsStore
      .getState()
      .accounts.find((_account) => _account.id === accountId)
  }, [accountId])

  /**
   * Tests all relays to see if they can sync
   */
  const testRelaySync = useCallback(
    async (relays: string[]) => {
      const statuses: Record<
        string,
        'connected' | 'connecting' | 'disconnected'
      > = {}

      relays.forEach((relay) => {
        statuses[relay] = 'connecting'
      })
      setRelayConnectionStatuses(statuses)

      for (const relay of relays) {
        try {
          const nostrApi = new NostrAPI([relay])
          await nostrApi.connect()

          if (
            account?.nostr?.commonNsec &&
            account.nostr.commonNpub &&
            account.nostr.deviceNpub
          ) {
            try {
              const testMessage = {
                created_at: Math.floor(Date.now() / 1000),
                public_key_bech32: account.nostr.deviceNpub
              }
              const compressedMessage = compressMessage(testMessage)
              const testEvent = await nostrApi.createKind1059(
                account.nostr.commonNsec,
                account.nostr.commonNpub,
                compressedMessage
              )
              await nostrApi.publishEvent(testEvent)
              statuses[relay] = 'connected'
            } catch (publishError) {
              statuses[relay] = 'disconnected'
            }
          } else {
            statuses[relay] = 'connected'
          }
        } catch (connectionError) {
          statuses[relay] = 'disconnected'
        }
        setRelayConnectionStatuses({ ...statuses })
      }

      if (accountId) {
        updateAccountNostrCallback(accountId, {
          relayStatuses: statuses,
          lastUpdated: new Date()
        })
      }
    },
    [account?.nostr, accountId, updateAccountNostrCallback]
  )

  /**
   * Gets the display info for relay connection status
   */
  const getRelayConnectionInfo = useCallback(
    (status: 'connected' | 'connecting' | 'disconnected') => {
      switch (status) {
        case 'connected':
          return {
            color: '#22c55e',
            text: t('account.nostrSync.relayStatusConnected')
          }
        case 'connecting':
          return {
            color: '#f59e0b',
            text: t('account.nostrSync.relayStatusConnecting')
          }
        case 'disconnected':
          return {
            color: '#ef4444',
            text: t('account.nostrSync.relayStatusDisconnected')
          }
        default:
          return { color: '#6b7280', text: 'Unknown' }
      }
    },
    [t]
  )

  /**
   * Clears all cached messages and processed events
   */
  const handleClearCaches = async () => {
    if (!accountId || !account) return

    try {
      setIsLoading(true)
      await clearStoredDMs(account)
      updateAccountNostrCallback(accountId, {
        ...account.nostr,
        dms: []
      })
      clearNostrState(accountId)
      clearProcessedMessageIds(accountId)
      clearProcessedEvents(accountId)
      setSelectedMembers(new Set())
      await new Promise((resolve) => setTimeout(resolve, 100))
      toast.success('Messages cleared successfully')
    } catch {
      toast.error('Failed to clear messages')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Loads Nostr account data
   */
  const loadNostrAccountData = useCallback(() => {
    if (!account || !accountId) return

    // Initialize nostr object if it doesn't exist
    if (!account.nostr) {
      updateAccountNostrCallback(accountId, {
        autoSync: false,
        relays: [],
        dms: [],
        trustedMemberDevices: [],
        commonNsec: '',
        commonNpub: '',
        deviceNsec: '',
        deviceNpub: ''
      })
      setSelectedRelays([])
      return
    }

    setSelectedRelays(account.nostr.relays || [])

    if (account.nostr.relayStatuses) {
      setRelayConnectionStatuses(account.nostr.relayStatuses)
    }
  }, [account, accountId, updateAccountNostrCallback])

  /**
   * Toggles auto-sync functionality and manages subscriptions
   */
  const handleToggleAutoSync = useCallback(async () => {
    try {
      if (!accountId) return

      // Initialize nostr object if it doesn't exist
      if (!account?.nostr) {
        updateAccountNostrCallback(accountId, {
          autoSync: false,
          relays: [],
          dms: [],
          trustedMemberDevices: [],
          commonNsec: '',
          commonNpub: '',
          deviceNsec: '',
          deviceNpub: '',
          syncStart: new Date(),
          lastUpdated: new Date()
        })
        return
      }

      if (account.nostr.autoSync) {
        // Turn sync OFF
        setIsSyncing(true)
        try {
          // Cleanup all subscriptions first
          await cleanupSubscriptions()

          // Set all relays to "disconnected" when turning sync off
          const allRelaysDisconnected: Record<
            string,
            'connected' | 'connecting' | 'disconnected'
          > = {}
          if (account.nostr.relays) {
            account.nostr.relays.forEach((relay) => {
              allRelaysDisconnected[relay] = 'disconnected'
            })
          }
          setRelayConnectionStatuses(allRelaysDisconnected)

          // Then update state
          updateAccountNostrCallback(accountId, {
            ...account.nostr,
            autoSync: false,
            relayStatuses: allRelaysDisconnected,
            lastUpdated: new Date()
          })
        } catch {
          toast.error('Failed to cleanup subscriptions')
        } finally {
          setIsSyncing(false)
        }
      } else {
        // Turn sync ON
        updateAccountNostrCallback(accountId, {
          ...account.nostr,
          autoSync: true,
          lastUpdated: new Date()
        })

        // Wait a tick for state to update
        await new Promise((resolve) => setTimeout(resolve, 0))

        // Get fresh account state after update using the callback
        const updatedAccount = getUpdatedAccount()

        if (
          updatedAccount?.nostr?.relays &&
          updatedAccount.nostr.relays.length > 0
        ) {
          setIsSyncing(true)
          try {
            // Test relay sync first
            await testRelaySync(updatedAccount.nostr.relays)

            deviceAnnouncement(updatedAccount)
            // Start both subscriptions using the new function
            await nostrSyncSubscriptions(updatedAccount, (loading) => {
              requestAnimationFrame(() => {
                setIsSyncing(loading)
              })
            })
          } catch {
            toast.error('Failed to setup sync')
          } finally {
            setIsSyncing(false)
          }
        }
      }
    } catch {
      toast.error('Failed to toggle auto sync')
      setIsSyncing(false)
    }
  }, [
    account?.nostr,
    accountId,
    testRelaySync,
    cleanupSubscriptions,
    deviceAnnouncement,
    getUpdatedAccount,
    nostrSyncSubscriptions,
    updateAccountNostr
  ])

  /**
   * Toggles member trust status
   */
  const toggleMember = useCallback(
    (npub: string) => {
      if (!accountId || !account?.nostr) return

      const isCurrentlyTrusted = selectedMembers.has(npub)

      setSelectedMembers((prev) => {
        const newSet = new Set(prev)
        if (isCurrentlyTrusted) {
          newSet.delete(npub)
        } else {
          newSet.add(npub)
        }
        return newSet
      })

      if (isCurrentlyTrusted) {
        updateAccountNostrCallback(accountId, {
          trustedMemberDevices: account.nostr.trustedMemberDevices.filter(
            (m) => m !== npub
          ),
          lastUpdated: new Date()
        })
      } else {
        updateAccountNostrCallback(accountId, {
          trustedMemberDevices: [...account.nostr.trustedMemberDevices, npub],
          lastUpdated: new Date()
        })
      }
    },
    [accountId, account?.nostr, selectedMembers, updateAccountNostrCallback]
  )

  // Navigation functions
  const goToSelectRelaysPage = () => {
    if (!accountId) return
    router.push({
      pathname: `/account/${accountId}/settings/nostr/selectRelays`
    })
  }

  const goToNostrKeyPage = () => {
    if (!accountId) return
    router.push({
      pathname: `/account/${accountId}/settings/nostr/nostrKey`
    })
  }

  const goToDevicesGroupChat = () => {
    if (!accountId) return
    router.push({
      pathname: `/account/${accountId}/settings/nostr/devicesGroupChat`
    })
  }

  // Effects
  useEffect(() => {
    if (account?.nostr?.trustedMemberDevices) {
      setSelectedMembers(new Set(account.nostr.trustedMemberDevices))
    }
  }, [members, account?.nostr?.trustedMemberDevices])

  useEffect(() => {
    if (account && accountId) {
      // Initialize nostr object if it doesn't exist
      if (!account.nostr) {
        updateAccountNostrCallback(accountId, {
          autoSync: false,
          relays: [],
          dms: [],
          trustedMemberDevices: [],
          commonNsec: '',
          commonNpub: '',
          deviceNsec: '',
          deviceNpub: ''
        })
        return // Return early as we'll re-run this effect after the update
      }

      if (!commonNsec) {
        if (account.nostr.commonNsec && account.nostr.commonNpub) {
          setCommonNsec(account.nostr.commonNsec)
        } else {
          generateCommonNostrKeys(account)
            .then((keys) => {
              if (keys) {
                setCommonNsec(keys.commonNsec as string)
                updateAccountNostrCallback(accountId, {
                  ...account.nostr,
                  commonNsec: keys.commonNsec,
                  commonNpub: keys.commonNpub
                })
              }
            })
            .catch(() => {
              throw new Error('Error loading common Nostr keys')
            })
        }
      }
    }
  }, [
    account,
    accountId,
    generateCommonNostrKeys,
    updateAccountNostrCallback,
    commonNsec
  ])

  useEffect(() => {
    if (account && accountId && !isGeneratingKeys) {
      // Initialize nostr object if it doesn't exist
      if (!account.nostr) {
        updateAccountNostrCallback(accountId, {
          autoSync: false,
          relays: [],
          dms: [],
          trustedMemberDevices: [],
          commonNsec: '',
          commonNpub: '',
          deviceNsec: '',
          deviceNpub: ''
        })
        return // Return early as we'll re-run this effect after the update
      }

      // Only try to load device keys if we don't have them yet and haven't generated them
      if (
        (!account.nostr.deviceNsec || !account.nostr.deviceNpub) &&
        !keysGenerated
      ) {
        setIsGeneratingKeys(true)
        setKeysGenerated(true)
        NostrAPI.generateNostrKeys()
          .then((keys) => {
            if (keys) {
              setDeviceNsec(keys.nsec)
              setDeviceNpub(keys.npub)
              generateColorFromNpub(keys.npub).then(setDeviceColor)
              updateAccountNostrCallback(accountId, {
                ...account.nostr,
                deviceNpub: keys.npub,
                deviceNsec: keys.nsec
              })
            }
          })
          .catch(() => {
            toast.error('Failed to generate device keys')
            setKeysGenerated(false)
          })
          .finally(() => {
            setIsGeneratingKeys(false)
          })
      } else if (account.nostr.deviceNsec && account.nostr.deviceNpub) {
        // If we already have the keys, just set them
        setDeviceNsec(account.nostr.deviceNsec)
        setDeviceNpub(account.nostr.deviceNpub)
        generateColorFromNpub(account.nostr.deviceNpub).then(setDeviceColor)
        setKeysGenerated(true)
      }
    }
  }, [account, accountId, isGeneratingKeys, updateAccountNostrCallback])

  // Reset key generation state when account changes
  useEffect(() => {
    if (account?.nostr?.deviceNsec && account?.nostr?.deviceNpub) {
      setKeysGenerated(true)
    } else {
      setKeysGenerated(false)
    }
  }, [account?.id])

  useEffect(() => {
    if (deviceNpub && deviceColor === '#404040') {
      generateColorFromNpub(deviceNpub).then(setDeviceColor)
    }
  }, [deviceNpub, deviceColor])

  useEffect(() => {
    if (account) {
      loadNostrAccountData()
    }
  }, [account, loadNostrAccountData])

  // Add effect to handle auto-sync on mount
  useEffect(() => {
    const startAutoSync = async () => {
      if (!account?.nostr?.autoSync || !account?.nostr?.relays?.length) return

      setIsSyncing(true)
      try {
        deviceAnnouncement(account)
        await nostrSyncSubscriptions(account, (loading) => {
          requestAnimationFrame(() => {
            setIsSyncing(loading)
          })
        })
      } catch {
        toast.error('Failed to setup sync')
      } finally {
        setIsSyncing(false)
      }
    }

    startAutoSync()
  }, [account, deviceAnnouncement, nostrSyncSubscriptions])

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
              variant={account?.nostr?.autoSync ? 'danger' : 'secondary'}
              label={
                account?.nostr?.autoSync ? 'Turn sync OFF' : 'Turn sync ON'
              }
              onPress={handleToggleAutoSync}
              disabled={
                !account?.nostr?.autoSync && selectedRelays.length === 0
              }
            />
            {!account?.nostr?.autoSync && selectedRelays.length === 0 && (
              <SSText color="muted" center>
                {t('account.nostrSync.noRelaysWarning')}
              </SSText>
            )}
            {isSyncing && (
              <SSHStack gap="sm" style={{ justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={Colors.white} />
                <SSText color="muted">Syncing with Nostr relays</SSText>
              </SSHStack>
            )}
            {!isSyncing && (
              <SSHStack gap="sm" style={{ justifyContent: 'center' }}>
                <SSText color="muted">
                  Last sync:{' '}
                  {(() => {
                    const lastEOSE = useNostrStore
                      .getState()
                      .getLastProtocolEOSE(accountId)
                    if (!lastEOSE) return 'Never'
                    return new Date(lastEOSE * 1000).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })
                  })()}
                </SSText>
              </SSHStack>
            )}
            <SSHStack gap="md">
              <SSButton
                style={{ flex: 0.9 }}
                label={t('account.nostrSync.setKeys')}
                onPress={goToNostrKeyPage}
                disabled={isSyncing}
              />
              <SSButton
                style={{ flex: 0.9 }}
                label={t('account.nostrSync.manageRelays', {
                  count: selectedRelays.length
                })}
                onPress={goToSelectRelaysPage}
                disabled={isSyncing}
              />
            </SSHStack>
            {selectedRelays.length === 0 && account?.nostr?.autoSync && (
              <SSText color="white" weight="bold" center>
                {t('account.nostrSync.noRelaysWarning')}
              </SSText>
            )}
            {/* Personal Device Keys */}
            <SSVStack gap="sm">
              <SSText center>{t('account.nostrSync.deviceKeys')}</SSText>
              <SSVStack gap="xxs" style={styles.keysContainer}>
                {deviceNsec && deviceNpub ? (
                  <>
                    <SSVStack gap="xxs">
                      <SSText color="muted" center>
                        {t('account.nostrSync.nsec')}
                      </SSText>
                      <SSTextClipboard text={deviceNsec || ''}>
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
                            width: 10,
                            height: 10,
                            borderRadius: 10,
                            backgroundColor: deviceColor,
                            marginTop: 3,
                            marginLeft: 30,
                            marginRight: -30
                          }}
                        />
                        <SSTextClipboard text={deviceNpub || ''}>
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
                    <ActivityIndicator color={Colors.white} />
                    <SSText uppercase color="white">
                      {t('account.nostrSync.loadingKeys')}
                    </SSText>
                  </SSHStack>
                )}
              </SSVStack>
            </SSVStack>
            <SSButton
              style={{ marginTop: 30, marginBottom: 10 }}
              variant="secondary"
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
                            <SSHStack gap="sm" style={{ flex: 0.7 }}>
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
                              <SSTextClipboard text={member.npub || ''}>
                                <SSText
                                  center
                                  size="lg"
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

            {/* Relay Status section */}
            {selectedRelays.length > 0 && (
              <SSVStack gap="sm">
                <SSText center>{t('account.nostrSync.relayStatus')}</SSText>
                <SSVStack gap="sm" style={styles.relayStatusContainer}>
                  {selectedRelays.map((relay, index) => {
                    const status =
                      relayConnectionStatuses[relay] || 'disconnected'
                    const statusInfo = getRelayConnectionInfo(status)

                    return (
                      <SSHStack
                        key={index}
                        gap="sm"
                        style={styles.relayStatusItem}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: statusInfo.color,
                            marginTop: 1,
                            marginRight: 8
                          }}
                        />
                        <SSText style={{ flex: 1 }} size="sm">
                          {relay}
                        </SSText>
                        <SSText
                          size="sm"
                          color={
                            status === 'connected'
                              ? 'white'
                              : status === 'disconnected'
                                ? 'white'
                                : 'muted'
                          }
                          style={{ color: statusInfo.color }}
                        >
                          {statusInfo.text}
                        </SSText>
                        {status === 'connecting' && (
                          <ActivityIndicator
                            size="small"
                            color={statusInfo.color}
                          />
                        )}
                      </SSHStack>
                    )
                  })}
                </SSVStack>
              </SSVStack>
            )}
          </SSVStack>
          {/* Debug buttons */}
          <SSHStack gap="xs" style={{ marginTop: 30 }}>
            <SSButton
              label="Clear Caches"
              onPress={handleClearCaches}
              disabled={isLoading}
              variant="subtle"
              style={{ flex: 1 }}
            />
          </SSHStack>
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
  },
  relayStatusContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    padding: 12,
    borderWidth: 1
  },
  relayStatusItem: {
    alignItems: 'center',
    paddingVertical: 4
  }
})

export default NostrSync
