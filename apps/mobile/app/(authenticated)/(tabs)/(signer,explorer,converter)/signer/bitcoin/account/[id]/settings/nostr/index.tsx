import {
  Redirect,
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams
} from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'
import { useStoreWithEqualityFn } from 'zustand/traditional'

import { NostrAPI } from '@/api/nostr'

// Sync status phases
type SyncStatus = 'idle' | 'connecting' | 'syncing'

// Messages to cycle through during sync
const SYNC_MESSAGES = [
  'Syncing with Nostr relays',
  'Finding other members',
  'Looking for labels'
]
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
import type { NostrAccount } from '@/types/models/Nostr'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatDate } from '@/utils/date'
import { compressMessage, generateColorFromNpub } from '@/utils/nostr'

// Custom equality function that compares nostr config without dms
function nostrConfigEqual(
  a: Record<string, unknown> | null,
  b: Record<string, unknown> | null
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  // Compare only the fields we care about
  const keys = [
    'autoSync',
    'relays',
    'relayStatuses',
    'commonNsec',
    'commonNpub',
    'deviceNsec',
    'deviceNpub',
    'trustedMemberDevices',
    'npubAliases'
  ]
  for (const key of keys) {
    const aVal = a[key]
    const bVal = b[key]
    if (aVal !== bVal) {
      // For arrays/objects, do JSON comparison
      if (
        typeof aVal === 'object' &&
        typeof bVal === 'object' &&
        JSON.stringify(aVal) === JSON.stringify(bVal)
      ) {
        continue
      }
      return false
    }
  }
  return true
}

export default function NostrSync() {
  // Account and store hooks
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const updateAccountNostr = useAccountsStore(
    (state) => state.updateAccountNostr
  )

  // Select account with custom equality that ignores nostr.dms changes
  const account = useStoreWithEqualityFn(
    useAccountsStore,
    (state) => {
      const acc = state.accounts.find((_account) => _account.id === accountId)
      return acc
    },
    (a, b) => {
      if (a === b) return true
      if (!a || !b) return false
      if (a.id !== b.id || a.name !== b.name || a.policyType !== b.policyType) {
        return false
      }
      // Compare nostr config without dms
      return nostrConfigEqual(
        a.nostr as Record<string, unknown> | null,
        b.nostr as Record<string, unknown> | null
      )
    }
  )

  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false)
  const [keysGenerated, setKeysGenerated] = useState(false)

  const updateAccountNostrCallback = useCallback(
    (accountId: string, nostrData: Partial<NostrAccount>) => {
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
  const setSyncing = useNostrStore((state) => state.setSyncing)
  const lastProtocolEOSE = useNostrStore((state) =>
    accountId ? state.lastProtocolEOSE[accountId] : undefined
  )

  // Members management - using Map for O(1) deduplication instead of O(n²) with .some()
  const members = useNostrStore(
    useShallow((state) => {
      if (!accountId) return []
      const accountMembers = state.members[accountId] || []
      const seen = new Map<string, { npub: string; color: string }>()
      for (const member of accountMembers) {
        const normalized =
          typeof member === 'string'
            ? { npub: member, color: '#404040' }
            : member
        if (!seen.has(normalized.npub)) {
          seen.set(normalized.npub, normalized)
        }
      }
      return Array.from(seen.values())
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMessageIndex, setSyncMessageIndex] = useState(0)
  const [commonNsec, setCommonNsec] = useState('')
  const [deviceNsec, setDeviceNsec] = useState('')
  const [deviceNpub, setDeviceNpub] = useState('')
  const [deviceColor, setDeviceColor] = useState('#404040')
  const [selectedRelays, setSelectedRelays] = useState<string[]>([])
  const [relayConnectionStatuses, setRelayConnectionStatuses] = useState<
    Record<string, 'connected' | 'connecting' | 'disconnected'>
  >({})

  const previousRelaysRef = useRef<string[]>([])

  // Cycle through sync messages when syncing
  useEffect(() => {
    if (syncStatus !== 'syncing') {
      setSyncMessageIndex(0)
      return
    }
    const interval = setInterval(() => {
      setSyncMessageIndex((prev) => (prev + 1) % SYNC_MESSAGES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [syncStatus])

  // Prefer store for device keys so we show updated values immediately after saving on manage-keys page (no stale local state)
  const displayDeviceNpub = account?.nostr?.deviceNpub ?? deviceNpub
  const displayDeviceNsec = account?.nostr?.deviceNsec ?? deviceNsec

  // When returning from manage-keys (or any focus), align local with store so we don't briefly show old key then new
  useFocusEffect(
    useCallback(() => {
      if (
        !account?.nostr?.deviceNpub ||
        !account.nostr.deviceNsec ||
        account.nostr.deviceNpub === deviceNpub
      ) {
        return
      }
      setDeviceNsec(account.nostr.deviceNsec)
      setDeviceNpub(account.nostr.deviceNpub)
      generateColorFromNpub(account.nostr.deviceNpub).then(setDeviceColor)
    }, [account?.nostr?.deviceNpub, account?.nostr?.deviceNsec, deviceNpub])
  )

  const testRelaySync = useCallback(
    async (relays: string[]) => {
      // Set all relays to connecting state
      const initialStatuses = Object.fromEntries(
        relays.map((r) => [r, 'connecting' as const])
      )
      setRelayConnectionStatuses(initialStatuses)

      // Connect to all relays in parallel
      const results = await Promise.allSettled(
        relays.map(async (relay) => {
          try {
            const nostrApi = new NostrAPI([relay])
            await nostrApi.connect()

            if (
              account?.nostr?.commonNsec &&
              account.nostr.commonNpub &&
              account.nostr.deviceNpub
            ) {
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
            }
            return { relay, status: 'connected' as const }
          } catch {
            return { relay, status: 'disconnected' as const }
          }
        })
      )

      // Build final statuses from results
      const finalStatuses: Record<
        string,
        'connected' | 'connecting' | 'disconnected'
      > = {}
      results.forEach((result, index) => {
        const relay = relays[index]
        if (result.status === 'fulfilled') {
          finalStatuses[relay] = result.value.status
        } else {
          finalStatuses[relay] = 'disconnected'
        }
      })

      setRelayConnectionStatuses(finalStatuses)

      if (accountId) {
        updateAccountNostrCallback(accountId, {
          relayStatuses: finalStatuses,
          lastUpdated: new Date()
        })
      }
    },
    [account?.nostr, accountId, updateAccountNostrCallback]
  )

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
    []
  )

  /**
   * Clears all cached messages and processed events
   */
  const handleClearCaches = async () => {
    if (!accountId || !account) return

    try {
      setIsLoading(true)
      await clearStoredDMs(account)
      updateAccountNostrCallback(accountId, { dms: [] })
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
      previousRelaysRef.current = []
      return
    }

    const currentRelays = account.nostr.relays || []
    setSelectedRelays(currentRelays)

    if (previousRelaysRef.current.length === 0 && currentRelays.length > 0) {
      previousRelaysRef.current = [...currentRelays]
    }

    if (account.nostr.relayStatuses) {
      setRelayConnectionStatuses(account.nostr.relayStatuses)
    }
  }, [account, accountId, updateAccountNostrCallback])

  /**
   * Toggles auto-sync functionality and manages subscriptions
   */
  const handleToggleAutoSync = useCallback(async () => {
    try {
      if (!accountId || !account) return

      if (!account.nostr) {
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
        setSyncStatus('connecting')
        if (accountId) setSyncing(accountId, true)

        await cleanupSubscriptions().catch(() => {
          toast.error('Failed to cleanup subscriptions')
        })

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

        updateAccountNostrCallback(accountId, {
          autoSync: false,
          relayStatuses: allRelaysDisconnected,
          lastUpdated: new Date()
        })

        setSyncStatus('idle')
        if (accountId) setSyncing(accountId, false)
      } else {
        // Turn sync ON – only update these fields so we never overwrite device keys
        updateAccountNostrCallback(accountId, {
          autoSync: true,
          lastUpdated: new Date()
        })

        const updatedAccount = {
          ...account,
          nostr: { ...account.nostr, autoSync: true, lastUpdated: new Date() }
        }

        if (
          !updatedAccount?.nostr?.deviceNsec ||
          !updatedAccount?.nostr?.deviceNpub
        ) {
          toast.error('Missing required Nostr configuration')
        }

        if (
          updatedAccount?.nostr?.relays &&
          updatedAccount.nostr.relays.length > 0
        ) {
          setSyncStatus('connecting')
          if (accountId) setSyncing(accountId, true)
          try {
            await testRelaySync(updatedAccount.nostr.relays)
            setSyncStatus('syncing')
            deviceAnnouncement(updatedAccount)
            await nostrSyncSubscriptions(updatedAccount, (loading) => {
              requestAnimationFrame(() => {
                setSyncStatus(loading ? 'syncing' : 'idle')
                if (accountId) setSyncing(accountId, loading)
              })
            })
          } catch {
            toast.error('Failed to setup sync')
          } finally {
            setSyncStatus('idle')
            if (accountId) setSyncing(accountId, false)
          }
        }
      }
    } catch {
      toast.error('Failed to toggle auto sync')
      setSyncStatus('idle')
      if (accountId) setSyncing(accountId, false)
    }
  }, [
    account,
    accountId,
    testRelaySync,
    cleanupSubscriptions,
    deviceAnnouncement,
    nostrSyncSubscriptions,
    updateAccountNostrCallback,
    setSyncing
  ])

  const toggleMember = useCallback(
    (npub: string) => {
      if (!accountId || !account?.nostr) return

      const isCurrentlyTrusted = selectedMembers.has(npub)

      if (isCurrentlyTrusted) {
        setSelectedMembers((prev) => {
          const newSet = new Set(prev)
          newSet.delete(npub)
          return newSet
        })

        updateAccountNostrCallback(accountId, {
          trustedMemberDevices: account.nostr.trustedMemberDevices.filter(
            (m) => m !== npub
          ),
          lastUpdated: new Date()
        })
      } else {
        setSelectedMembers((prev) => {
          const newSet = new Set(prev)
          newSet.add(npub)
          return newSet
        })

        updateAccountNostrCallback(accountId, {
          trustedMemberDevices: [...account.nostr.trustedMemberDevices, npub],
          lastUpdated: new Date()
        })

        router.push({
          pathname: `/signer/bitcoin/account/${accountId}/settings/nostr/device/[npub]`,
          params: { npub }
        })
      }
    },
    [accountId, account?.nostr, selectedMembers, updateAccountNostrCallback]
  )

  // Navigation functions
  const goToSelectRelaysPage = () => {
    if (!accountId) return
    router.push({
      pathname: `/signer/bitcoin/account/${accountId}/settings/nostr/selectRelays`
    })
  }

  const goToNostrKeyPage = () => {
    if (!accountId) return
    router.push({
      pathname: `/signer/bitcoin/account/${accountId}/settings/nostr/nostrKey`
    })
  }

  const goToDevicesGroupChat = () => {
    if (!accountId) return
    router.push({
      pathname: `/signer/bitcoin/account/${accountId}/settings/nostr/devicesGroupChat`
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

      // Always check account state first, not local state
      if (account.nostr.commonNsec && account.nostr.commonNpub) {
        if (!commonNsec) {
          setCommonNsec(account.nostr.commonNsec)
        } else {
          generateCommonNostrKeys(account)
            .then((keys) => {
              if (keys && 'commonNsec' in keys) {
                setCommonNsec(keys.commonNsec as string)
                updateAccountNostrCallback(accountId, {
                  commonNsec: keys.commonNsec,
                  commonNpub: keys.commonNpub
                })
              }
            })
            .catch(() => {
              toast.error(t('account.nostrSync.errorLoadingCommonKeys'))
            })
        }
      } else {
        generateCommonNostrKeys(account)
          .then((keys) => {
            if (keys && 'commonNsec' in keys && 'commonNpub' in keys) {
              setCommonNsec(keys.commonNsec as string)
              updateAccountNostrCallback(accountId, {
                commonNsec: keys.commonNsec,
                commonNpub: keys.commonNpub
              })
            }
          })
          .catch(() => {
            toast.error(t('account.nostrSync.errorLoadingCommonKeys'))
          })
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
    if (!account || !accountId || isGeneratingKeys) {
      return
    }

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

    // Store has device keys: only sync to local when local is empty (initial load). Avoid overwriting on every account ref change so we don't trigger re-render loops; display uses store via displayDeviceNpub.
    if (account.nostr.deviceNsec && account.nostr.deviceNpub) {
      if (!deviceNpub) {
        setDeviceNsec(account.nostr.deviceNsec)
        setDeviceNpub(account.nostr.deviceNpub)
        generateColorFromNpub(account.nostr.deviceNpub).then(setDeviceColor)
      }
      setKeysGenerated(true)
      return
    }

    if (keysGenerated) {
      return
    }

    setIsGeneratingKeys(true)
    setKeysGenerated(true)

    NostrAPI.generateNostrKeys()
      .then((keys) => {
        if (!keys) {
          return
        }
        if (account?.nostr?.deviceNsec && account.nostr.deviceNpub) {
          setDeviceNsec(account.nostr.deviceNsec)
          setDeviceNpub(account.nostr.deviceNpub)
          generateColorFromNpub(account.nostr.deviceNpub).then(setDeviceColor)
        } else if (account?.nostr) {
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
  }, [
    account,
    accountId,
    deviceNpub,
    isGeneratingKeys,
    keysGenerated,
    updateAccountNostrCallback
  ])

  useEffect(() => {
    if (displayDeviceNpub) {
      generateColorFromNpub(displayDeviceNpub).then(setDeviceColor)
    } else {
      setDeviceColor('#404040')
    }
  }, [displayDeviceNpub])

  useEffect(() => {
    if (account) {
      loadNostrAccountData()
    }
  }, [account, loadNostrAccountData])

  // Add effect to handle auto-sync on mount
  useEffect(() => {
    const startAutoSync = async () => {
      if (!account?.nostr?.autoSync || !account?.nostr?.relays?.length) return

      setSyncStatus('syncing')
      if (accountId) setSyncing(accountId, true)
      deviceAnnouncement(account)
      await nostrSyncSubscriptions(account, (loading) => {
        requestAnimationFrame(() => {
          setSyncStatus(loading ? 'syncing' : 'idle')
          if (accountId) setSyncing(accountId, loading)
        })
      }).catch(() => {
        toast.error('Failed to setup sync')
      })

      setSyncStatus('idle')
      if (accountId) setSyncing(accountId, false)
    }

    startAutoSync()
  }, [
    account,
    accountId,
    deviceAnnouncement,
    nostrSyncSubscriptions,
    setSyncing
  ])

  // Auto-trigger sync when a new relay is added and sync is ON
  useFocusEffect(
    useCallback(() => {
      if (!accountId || !account?.nostr) {
        previousRelaysRef.current = []
        return
      }

      const currentRelays = account.nostr.relays || []
      const previousRelays = previousRelaysRef.current

      if (previousRelays.length === 0) {
        previousRelaysRef.current = [...currentRelays]
        return
      }

      const hasNewRelay = currentRelays.some(
        (relay) => !previousRelays.includes(relay)
      )

      if (
        !(
          hasNewRelay &&
          account.nostr.autoSync &&
          currentRelays.length > 0 &&
          previousRelays.length > 0
        )
      ) {
        return
      }

      setSyncStatus('connecting')
      if (accountId) setSyncing(accountId, true)

      const triggerAutoSync = async () => {
        try {
          await testRelaySync(currentRelays)
          setSyncStatus('syncing')
          deviceAnnouncement(account)
          await nostrSyncSubscriptions(account, (loading) => {
            requestAnimationFrame(() => {
              setSyncStatus(loading ? 'syncing' : 'idle')
              if (accountId) setSyncing(accountId, loading)
            })
          })
        } catch {
          toast.error('Failed to setup sync with new relay')
        } finally {
          setSyncStatus('idle')
          if (accountId) setSyncing(accountId, false)
        }
      }

      triggerAutoSync()

      previousRelaysRef.current = [...currentRelays]
    }, [
      account,
      accountId,
      deviceAnnouncement,
      nostrSyncSubscriptions,
      setSyncing,
      testRelaySync
    ])
  )

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
                syncStatus !== 'idle' ||
                (!account?.nostr?.autoSync && selectedRelays.length === 0)
              }
            />
            {!account?.nostr?.autoSync && selectedRelays.length === 0 && (
              <SSText color="muted" center>
                {t('account.nostrSync.noRelaysWarning')}
              </SSText>
            )}
            {syncStatus === 'connecting' && (
              <SSHStack gap="sm" style={{ justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={Colors.white} />
                <SSText color="muted">Connecting to relays</SSText>
              </SSHStack>
            )}
            {syncStatus === 'syncing' && (
              <SSHStack gap="sm" style={{ justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={Colors.white} />
                <SSText color="muted">{SYNC_MESSAGES[syncMessageIndex]}</SSText>
              </SSHStack>
            )}
            {syncStatus === 'idle' && (
              <SSHStack gap="sm" style={{ justifyContent: 'center' }}>
                <SSText color="muted">
                  Last sync:{' '}
                  {lastProtocolEOSE ? formatDate(lastProtocolEOSE) : 'Never'}
                </SSText>
              </SSHStack>
            )}
            <SSButton
              label={t('account.nostrSync.manageRelays', {
                count: selectedRelays.length
              })}
              onPress={goToSelectRelaysPage}
              disabled={syncStatus !== 'idle'}
            />
            {selectedRelays.length === 0 && account?.nostr?.autoSync && (
              <SSText color="white" weight="bold" center>
                {t('account.nostrSync.noRelaysWarning')}
              </SSText>
            )}
            {/* Personal Device Keys */}
            <SSVStack gap="sm">
              <SSText center>{t('account.nostrSync.deviceKeys')}</SSText>
              <SSVStack gap="xxs" style={styles.keysContainer}>
                {displayDeviceNsec && displayDeviceNpub ? (
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
                      <SSTextClipboard text={displayDeviceNpub || ''}>
                        <SSText
                          center
                          size="xl"
                          type="mono"
                          style={styles.keyText}
                          selectable
                        >
                          {displayDeviceNpub.slice(0, 12) +
                            '...' +
                            displayDeviceNpub.slice(-4)}
                        </SSText>
                      </SSTextClipboard>
                    </SSHStack>
                  </SSVStack>
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
              label={t('account.nostrSync.setKeys')}
              onPress={goToNostrKeyPage}
              disabled={syncStatus !== 'idle'}
            />
            <SSButton
              style={{ marginTop: 30, marginBottom: 10 }}
              variant="secondary"
              label={t('account.nostrSync.devicesGroupChat.title')}
              onPress={goToDevicesGroupChat}
              disabled={syncStatus !== 'idle'}
            />
            {/* Members section */}
            <SSVStack gap="sm">
              <SSText center>{t('account.nostrSync.members')}</SSText>
              {members && members.length > 0 ? (
                <SSVStack gap="md" style={styles.membersContainer}>
                  {members
                    .filter((member) => member.npub !== displayDeviceNpub)
                    .map((member, index) => (
                      <SSVStack key={index} gap="md">
                        {member?.npub && (
                          <SSHStack gap="md">
                            <SSVStack gap="xxs" style={{ flex: 0.7 }}>
                              <SSHStack gap="md">
                                <View
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: member.color || '#404040',
                                    marginTop: 1,
                                    marginLeft: 20,
                                    marginRight: 0
                                  }}
                                />
                                <Pressable
                                  disabled={syncStatus !== 'idle'}
                                  onPress={() => {
                                    router.push({
                                      pathname: `/signer/bitcoin/account/${accountId}/settings/nostr/device/[npub]`,
                                      params: { npub: member.npub }
                                    })
                                  }}
                                  style={{ opacity: syncStatus !== 'idle' ? 0.5 : 1 }}
                                >
                                  <SSVStack gap="none">
                                    {account?.nostr?.npubAliases?.[
                                      member.npub
                                    ] ? (
                                      <>
                                        <SSText
                                          size="md"
                                          style={styles.memberText}
                                          selectable
                                        >
                                          {
                                            account.nostr.npubAliases[
                                              member.npub
                                            ]
                                          }
                                        </SSText>
                                        <SSTextClipboard
                                          text={member.npub || ''}
                                        >
                                          <SSText
                                            size="sm"
                                            type="mono"
                                            style={styles.memberNpubText}
                                            selectable
                                          >
                                            {member.npub.slice(0, 12) +
                                              '...' +
                                              member.npub.slice(-4)}
                                          </SSText>
                                        </SSTextClipboard>
                                      </>
                                    ) : (
                                      <SSTextClipboard text={member.npub || ''}>
                                        <SSText
                                          size="md"
                                          type="mono"
                                          style={styles.memberText}
                                          selectable
                                        >
                                          {member.npub.slice(0, 12) +
                                            '...' +
                                            member.npub.slice(-4)}
                                        </SSText>
                                      </SSTextClipboard>
                                    )}
                                  </SSVStack>
                                </Pressable>
                              </SSHStack>
                            </SSVStack>
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
                              disabled={syncStatus !== 'idle'}
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
    color: Colors.white,
    marginBottom: -4
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
    padding: 12
  },
  relayStatusItem: {
    alignItems: 'center',
    paddingVertical: 4
  },
  memberNpubText: {
    letterSpacing: 1,
    color: Colors.gray[400]
  }
})
