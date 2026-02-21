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
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native'
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
import type { NostrAccount } from '@/types/models/Nostr'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatDate } from '@/utils/date'
import { generateColorFromNpub } from '@/utils/nostr'

export default function NostrSync() {
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

  const previousRelaysRef = useRef<string[]>([])

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
      const statuses: Record<
        string,
        'connected' | 'connecting' | 'disconnected'
      > = {}

      relays.forEach((relay) => {
        statuses[relay] = 'connecting'
      })
      setRelayConnectionStatuses(statuses)

      // Test connectivity only - don't publish events here to avoid rate limiting
      // Device announcement is sent separately via deviceAnnouncement()
      for (const relay of relays) {
        try {
          const nostrApi = new NostrAPI([relay])
          await nostrApi.connect()
          statuses[relay] = 'connected'
        } catch {
          toast.error('Failed to connect to relay ' + relay)
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
    [accountId, updateAccountNostrCallback]
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
   * Loads Nostr account data from store. Accepts account so it can be called
   * with fresh store state without being in effect deps (avoids update loops).
   */
  const loadNostrAccountData = useCallback(
    (acc: NonNullable<typeof account>) => {
      if (!acc || !accountId) return

      if (!acc.nostr) {
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

      const currentRelays = acc.nostr.relays || []
      setSelectedRelays(currentRelays)

      if (previousRelaysRef.current.length === 0 && currentRelays.length > 0) {
        previousRelaysRef.current = [...currentRelays]
      }

      if (acc.nostr.relayStatuses) {
        setRelayConnectionStatuses(acc.nostr.relayStatuses)
      }
    },
    [accountId, updateAccountNostrCallback]
  )

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
        setIsSyncing(true)
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

        setIsSyncing(false)
        if (accountId) setSyncing(accountId, false)
      } else {
        // Turn sync ON – set syncStart so DMs from this session are distinguished; caller must set before subscribe to avoid effect loops
        updateAccountNostrCallback(accountId, {
          autoSync: true,
          syncStart: new Date(),
          lastUpdated: new Date()
        })

        const updatedAccount = useAccountsStore
          .getState()
          .accounts.find((a) => a.id === accountId)

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
          setIsSyncing(true)
          if (accountId) setSyncing(accountId, true)
          try {
            await testRelaySync(updatedAccount.nostr.relays)
            deviceAnnouncement(updatedAccount)
            await nostrSyncSubscriptions(updatedAccount, (loading) => {
              requestAnimationFrame(() => {
                setIsSyncing(loading)
                if (accountId) setSyncing(accountId, loading)
              })
            })
          } catch {
            toast.error('Failed to setup sync')
          } finally {
            setIsSyncing(false)
            if (accountId) setSyncing(accountId, false)
          }
        }
      }
    } catch {
      toast.error('Failed to toggle auto sync')
      setIsSyncing(false)
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

  // Effects – use stable deps so we don't re-run on every account ref change
  const trustedDevicesKey = JSON.stringify(
    account?.nostr?.trustedMemberDevices ?? []
  )
  useEffect(() => {
    const acc = useAccountsStore
      .getState()
      .accounts.find((a) => a.id === accountId)
    if (acc?.nostr?.trustedMemberDevices) {
      setSelectedMembers(new Set(acc.nostr.trustedMemberDevices))
    }
  }, [accountId, members, trustedDevicesKey])

  useEffect(() => {
    if (!account || !accountId) return

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
      return
    }

    const hasCommonKeys =
      !!account.nostr.commonNsec && !!account.nostr.commonNpub

    if (hasCommonKeys) {
      if (!commonNsec) {
        setCommonNsec(account.nostr.commonNsec)
      }
      return
    }

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
  }, [
    accountId,
    account?.id,
    account?.nostr?.commonNsec,
    account?.nostr?.commonNpub,
    generateCommonNostrKeys,
    updateAccountNostrCallback,
    commonNsec
  ])

  useEffect(() => {
    if (!account || !accountId) return

    // Initialize nostr object if it doesn't exist, then generate device keys in the same run
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
      setIsGeneratingKeys(true)
      NostrAPI.generateNostrKeys()
        .then((keys) => {
          if (!keys) return
          const current = useAccountsStore
            .getState()
            .accounts.find((a) => a.id === accountId)
          if (current?.nostr) {
            updateAccountNostrCallback(accountId, {
              ...current.nostr,
              deviceNpub: keys.npub,
              deviceNsec: keys.nsec,
              lastUpdated: new Date()
            })
          }
          setDeviceNsec(keys.nsec)
          setDeviceNpub(keys.npub)
          generateColorFromNpub(keys.npub).then(setDeviceColor)
          setKeysGenerated(true)
        })
        .catch(() => {
          toast.error('Failed to generate device keys')
        })
        .finally(() => setIsGeneratingKeys(false))
      return
    }

    // Store already has device keys: sync to local when local is empty
    if (account.nostr.deviceNsec && account.nostr.deviceNpub) {
      if (!deviceNpub) {
        setDeviceNsec(account.nostr.deviceNsec)
        setDeviceNpub(account.nostr.deviceNpub)
        generateColorFromNpub(account.nostr.deviceNpub).then(setDeviceColor)
      }
      setKeysGenerated(true)
      return
    }

    // No device keys yet and we're not already generating: generate once
    if (isGeneratingKeys || keysGenerated) return

    setIsGeneratingKeys(true)
    setKeysGenerated(true)
    NostrAPI.generateNostrKeys()
      .then((keys) => {
        if (!keys) return
        if (account?.nostr?.deviceNsec && account.nostr.deviceNpub) {
          setDeviceNsec(account.nostr.deviceNsec)
          setDeviceNpub(account.nostr.deviceNpub)
          generateColorFromNpub(account.nostr.deviceNpub).then(setDeviceColor)
        } else {
          const current = useAccountsStore
            .getState()
            .accounts.find((a) => a.id === accountId)
          if (current?.nostr) {
            updateAccountNostrCallback(accountId, {
              ...current.nostr,
              deviceNpub: keys.npub,
              deviceNsec: keys.nsec,
              lastUpdated: new Date()
            })
          }
          setDeviceNsec(keys.nsec)
          setDeviceNpub(keys.npub)
          generateColorFromNpub(keys.npub).then(setDeviceColor)
        }
      })
      .catch(() => {
        toast.error('Failed to generate device keys')
        setKeysGenerated(false)
      })
      .finally(() => setIsGeneratingKeys(false))
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

  // Run when accountId, nostr presence, or relay list changes; read account from store to avoid full account in deps (prevents update cascade).
  useEffect(() => {
    const acc = useAccountsStore
      .getState()
      .accounts.find((a) => a.id === accountId)
    if (acc) loadNostrAccountData(acc)
  }, [
    accountId,
    !!account?.nostr,
    account?.nostr?.relays?.length,
    loadNostrAccountData
  ])

  // When opening screen with sync already ON: only subscribe once. Use refs for
  // callbacks so this effect does not re-run every render (which caused subscribe
  // to be invoked in a loop and OOM). Only run when accountId/autoSync/relays change.
  const nostrSyncSubscriptionsRef = useRef(nostrSyncSubscriptions)
  const setSyncingRef = useRef(setSyncing)
  nostrSyncSubscriptionsRef.current = nostrSyncSubscriptions
  setSyncingRef.current = setSyncing

  const lastAutoSyncKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!account?.nostr?.autoSync || !account?.nostr?.relays?.length) {
      lastAutoSyncKeyRef.current = null
      return
    }

    const autoSyncKey = `${accountId}-${(account.nostr.relays || []).sort().join(',')}`
    if (lastAutoSyncKeyRef.current === autoSyncKey) return
    lastAutoSyncKeyRef.current = autoSyncKey

    const current = useAccountsStore
      .getState()
      .accounts.find((a) => a.id === accountId)
    if (!current?.nostr) return

    setIsSyncing(true)
    setSyncingRef.current(accountId, true)
    nostrSyncSubscriptionsRef
      .current(current, (loading) => {
        requestAnimationFrame(() => {
          setIsSyncing(loading)
          setSyncingRef.current(accountId, loading)
        })
      })
      .catch(() => {
        toast.error('Failed to setup sync')
      })
      .finally(() => {
        setIsSyncing(false)
        setSyncingRef.current(accountId, false)
      })
  }, [accountId, account?.nostr?.autoSync, account?.nostr?.relays?.length])

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

      setIsSyncing(true)
      if (accountId) setSyncing(accountId, true)

      const triggerAutoSync = async () => {
        try {
          await testRelaySync(currentRelays)
          deviceAnnouncement(account)
          await nostrSyncSubscriptions(account, (loading) => {
            requestAnimationFrame(() => {
              setIsSyncing(loading)
              if (accountId) setSyncing(accountId, loading)
            })
          })
        } catch {
          toast.error('Failed to setup sync with new relay')
        } finally {
          setIsSyncing(false)
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
                isSyncing ||
                (!account?.nostr?.autoSync && selectedRelays.length === 0)
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
                  {lastProtocolEOSE ? formatDate(lastProtocolEOSE) : 'Never'}
                </SSText>
              </SSHStack>
            )}
            <SSButton
              label={t('account.nostrSync.manageRelays', {
                count: selectedRelays.length
              })}
              onPress={goToSelectRelaysPage}
              disabled={isSyncing}
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
                    {(account?.nostr?.devicePicture ||
                      account?.nostr?.deviceDisplayName) && (
                      <SSVStack gap="xs" style={styles.deviceProfileRow}>
                        {account?.nostr?.devicePicture && (
                          <Image
                            source={{ uri: account.nostr.devicePicture }}
                            style={styles.deviceProfilePicture}
                            resizeMode="cover"
                          />
                        )}
                        {account?.nostr?.deviceDisplayName && (
                          <SSText center size="lg">
                            {account.nostr.deviceDisplayName}
                          </SSText>
                        )}
                      </SSVStack>
                    )}
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
              disabled={isSyncing}
            />
            <SSButton
              style={{ marginTop: 30, marginBottom: 10 }}
              variant="secondary"
              label={t('account.nostrSync.devicesGroupChat.title')}
              onPress={goToDevicesGroupChat}
              disabled={isSyncing}
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
                                  disabled={isSyncing}
                                  onPress={() => {
                                    router.push({
                                      pathname: `/signer/bitcoin/account/${accountId}/settings/nostr/device/[npub]`,
                                      params: { npub: member.npub }
                                    })
                                  }}
                                  style={{ opacity: isSyncing ? 0.5 : 1 }}
                                >
                                  <SSHStack gap="sm" style={styles.memberRow}>
                                    {account?.nostr?.npubProfiles?.[member.npub]
                                      ?.picture && (
                                      <Image
                                        source={{
                                          uri: account.nostr.npubProfiles[
                                            member.npub
                                          ].picture
                                        }}
                                        style={styles.memberAvatar}
                                        resizeMode="cover"
                                      />
                                    )}
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
                                        </>
                                      ) : (
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
                                      )}
                                      {account?.nostr?.npubProfiles?.[
                                        member.npub
                                      ]?.displayName && (
                                        <SSText
                                          size="sm"
                                          style={styles.memberDisplayName}
                                          selectable
                                        >
                                          {
                                            account.nostr.npubProfiles[
                                              member.npub
                                            ].displayName
                                          }
                                        </SSText>
                                      )}
                                    </SSVStack>
                                  </SSHStack>
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
                              disabled={isSyncing}
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
  deviceProfileRow: {
    alignItems: 'center',
    marginBottom: 4
  },
  deviceProfilePicture: {
    width: 64,
    height: 64,
    borderRadius: 32
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
  memberRow: {
    alignItems: 'center'
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16
  },
  memberDisplayName: {
    color: Colors.gray[400],
    marginTop: 2
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
