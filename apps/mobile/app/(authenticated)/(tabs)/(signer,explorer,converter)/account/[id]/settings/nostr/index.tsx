import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI } from '@/api/nostr'
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

  // Add this useCallback near the top of the component, after other hooks
  const getUpdatedAccount = useCallback(() => {
    return useAccountsStore
      .getState()
      .accounts.find((_account) => _account.id === accountId)
  }, [accountId])

  /**
   * Clears all cached messages and processed events
   */
  const handleClearCaches = async () => {
    if (!accountId || !account) return

    try {
      setIsLoading(true)
      await clearStoredDMs(account)
      updateAccountNostr(accountId, {
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
      updateAccountNostr(accountId, {
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
  }, [account, accountId, updateAccountNostr])

  /**
   * Toggles auto-sync functionality and manages subscriptions
   */
  const handleToggleAutoSync = useCallback(async () => {
    try {
      if (!accountId) return

      // Initialize nostr object if it doesn't exist
      if (!account?.nostr) {
        updateAccountNostr(accountId, {
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

          // Then update state
          updateAccountNostr(accountId, {
            ...account.nostr,
            autoSync: false,
            lastUpdated: new Date()
          })
        } catch {
          toast.error('Failed to cleanup subscriptions')
        } finally {
          setIsSyncing(false)
        }
      } else {
        // Turn sync ON
        updateAccountNostr(accountId, {
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
    cleanupSubscriptions,
    deviceAnnouncement,
    getUpdatedAccount,
    nostrSyncSubscriptions,
    updateAccountNostr
  ])

  /**
   * Toggles member trust status
   */
  const toggleMember = (npub: string) => {
    if (!accountId || !account?.nostr) return

    setSelectedMembers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(npub)) {
        newSet.delete(npub)
        updateAccountNostr(accountId, {
          trustedMemberDevices: account.nostr.trustedMemberDevices.filter(
            (m) => m !== npub
          ),
          lastUpdated: new Date()
        })
      } else {
        newSet.add(npub)
        updateAccountNostr(accountId, {
          trustedMemberDevices: [...account.nostr.trustedMemberDevices, npub],
          lastUpdated: new Date()
        })
      }
      return newSet
    })
  }

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
        updateAccountNostr(accountId, {
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
                updateAccountNostr(accountId, {
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
    updateAccountNostr,
    commonNsec
  ])

  useEffect(() => {
    if (account && accountId) {
      // Initialize nostr object if it doesn't exist
      if (!account.nostr) {
        updateAccountNostr(accountId, {
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

      // Only try to load device keys if we don't have them yet
      if (!account.nostr.deviceNsec || !account.nostr.deviceNpub) {
        NostrAPI.generateNostrKeys()
          .then((keys) => {
            if (keys) {
              setDeviceNsec(keys.nsec)
              setDeviceNpub(keys.npub)
              generateColorFromNpub(keys.npub).then(setDeviceColor)
              updateAccountNostr(accountId, {
                ...account.nostr,
                deviceNpub: keys.npub,
                deviceNsec: keys.nsec
              })
            }
          })
          .catch(() => {
            toast.error('Failed to generate device keys')
          })
      } else {
        // If we already have the keys, just set them
        setDeviceNsec(account.nostr.deviceNsec)
        setDeviceNpub(account.nostr.deviceNpub)
        generateColorFromNpub(account.nostr.deviceNpub).then(setDeviceColor)
      }
    }
  }, [account, accountId, updateAccountNostr])

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
  }
})

export default NostrSync
