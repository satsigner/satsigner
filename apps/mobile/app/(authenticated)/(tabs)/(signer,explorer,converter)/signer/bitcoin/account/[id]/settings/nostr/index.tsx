import {
  Redirect,
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams
} from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI } from '@/api/nostr'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import SSIconWarning from '@/components/icons/SSIconWarning'
import SSButton from '@/components/SSButton'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import { NOSTR_FALLBACK_NPUB_COLOR } from '@/constants/nostr'
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
import { formatDateShort } from '@/utils/date'
import { generateColorFromNpub, getPubKeyHexFromNpub } from '@/utils/nostr'

const SYNCING_MESSAGE_KEYS = [
  'account.nostrSync.syncingConnecting',
  'account.nostrSync.syncingDiscovering',
  'account.nostrSync.syncingFetching',
  'account.nostrSync.syncingWithRelays'
] as const

type MemberNameBlockProps = {
  npub: string
  displayName?: string
  alias?: string
  hasPicture: boolean
  memberColor?: string
}

function MemberNameBlock({
  npub,
  displayName,
  alias,
  hasPicture,
  memberColor
}: MemberNameBlockProps) {
  const titleLine =
    displayName && alias
      ? `${displayName} (${alias})`
      : displayName ?? alias ?? null
  const npubShort = `${npub.slice(0, 12)}...${npub.slice(-4)}`

  return (
    <>
      {titleLine ? (
        <SSText size="sm" style={styles.memberText} selectable>
          {titleLine}
        </SSText>
      ) : (
        <SSText size="sm" type="mono" style={styles.memberText} selectable>
          {npubShort}
        </SSText>
      )}
      {titleLine ? (
        <SSHStack gap="xs" style={styles.memberNpubRow}>
          {hasPicture && (
            <View
              style={[
                styles.memberColorDot,
                { backgroundColor: memberColor || NOSTR_FALLBACK_NPUB_COLOR }
              ]}
            />
          )}
          <SSText
            size="sm"
            type="mono"
            color="muted"
            style={styles.memberNpubUnderAlias}
            selectable
          >
            {npubShort}
          </SSText>
        </SSHStack>
      ) : null}
    </>
  )
}

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
  const setLastDataExchangeEOSE = useNostrStore(
    (state) => state.setLastDataExchangeEOSE
  )
  const lastProtocolEOSE = useNostrStore((state) =>
    accountId ? state.lastProtocolEOSE[accountId] : undefined
  )

  // Members management - subscribe to raw members array for reactivity
  const rawMembers = useNostrStore((state) =>
    accountId ? state.members[accountId] : undefined
  )

  // Normalize members in a separate memo to avoid selector complexity
  const members = useMemo(() => {
    if (!rawMembers) return []
    return rawMembers
      .map((member) =>
        typeof member === 'string'
          ? { npub: member, color: NOSTR_FALLBACK_NPUB_COLOR }
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
  }, [rawMembers])

  // Nostr sync hooks
  const {
    clearStoredDMs,
    generateCommonNostrKeys,
    deviceAnnouncement,
    cleanupSubscriptions,
    nostrSyncSubscriptions,
    restartSync,
    stopSync
  } = useNostrSync()

  // State management
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [commonNsec, setCommonNsec] = useState('')
  const [deviceNsec, setDeviceNsec] = useState('')
  const [deviceNpub, setDeviceNpub] = useState('')
  const [deviceColor, setDeviceColor] = useState(NOSTR_FALLBACK_NPUB_COLOR)
  const [selectedRelays, setSelectedRelays] = useState<string[]>([])
  const [relayConnectionStatuses, setRelayConnectionStatuses] = useState<
    Record<string, 'connected' | 'connecting' | 'disconnected'>
  >({})
  const [deletionModalVisible, setDeletionModalVisible] = useState(false)
  const [clearCachesModalVisible, setClearCachesModalVisible] = useState(false)
  const [syncingMessageIndex, setSyncingMessageIndex] = useState(0)
  const syncingMessage = SYNCING_MESSAGE_KEYS[syncingMessageIndex]

  useEffect(() => {
    if (!isSyncing) {
      setSyncingMessageIndex(0)
      return
    }
    const interval = setInterval(() => {
      setSyncingMessageIndex((i) =>
        i + 1 >= SYNCING_MESSAGE_KEYS.length ? 0 : i + 1
      )
    }, 2500)
    return () => clearInterval(interval)
  }, [isSyncing])

  const previousRelaysRef = useRef<string[]>([])
  const trustSyncRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (trustSyncRestartRef.current) {
        clearTimeout(trustSyncRestartRef.current)
        trustSyncRestartRef.current = null
      }
    }
  }, [accountId])

  // Prefer store for device keys so we show updated values immediately after saving on manage-keys page (no stale local state)
  const displayDeviceNpub = account?.nostr?.deviceNpub ?? deviceNpub
  const displayDeviceNsec = account?.nostr?.deviceNsec ?? deviceNsec
  const deviceKind0Picture =
    account?.nostr?.devicePicture ??
    (displayDeviceNpub &&
      account?.nostr?.npubProfiles?.[displayDeviceNpub]?.picture)
  const deviceKind0DisplayName =
    account?.nostr?.deviceDisplayName ??
    (displayDeviceNpub &&
      account?.nostr?.npubProfiles?.[displayDeviceNpub]?.displayName)
  const showDeviceKind0 = !!(deviceKind0Picture || deviceKind0DisplayName)

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
          toast.error(`Failed to connect to relay ${relay}`)
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
   * Full reset: stop sync, clear relays, DMs, Kind 0 data, and processed state.
   */
  const handleClearCaches = async () => {
    if (!accountId || !account?.nostr) return

    try {
      setIsLoading(true)
      setClearCachesModalVisible(false)
      stopSync(accountId)
      await clearStoredDMs(account)
      updateAccountNostrCallback(accountId, {
        autoSync: false,
        dms: [],
        relays: [],
        npubProfiles: undefined,
        npubAliases: undefined,
        deviceDisplayName: undefined,
        devicePicture: undefined,
        trustedMemberDevices: [],
        syncStart: new Date()
      })
      clearNostrState(accountId)
      clearProcessedMessageIds(accountId)
      clearProcessedEvents(accountId)
      setSelectedMembers(new Set())
      setSelectedRelays([])
      setRelayConnectionStatuses({})
      previousRelaysRef.current = []
      toast.success(t('account.nostrSync.clearCachesSuccess'))
    } catch {
      toast.error('Failed to clear local Nostr data')
    } finally {
      setIsLoading(false)
    }
  }

  const eventCount = account?.nostr?.dms?.length ?? 0

  function getDevicePubkeyHex(): string | null {
    const npub = account?.nostr?.deviceNpub
    return npub ? getPubKeyHexFromNpub(npub) : null
  }

  async function handleBackupEvents() {
    if (!account?.nostr) {
      toast.error(t('account.nostrSync.backupError'))
      return
    }
    try {
      const payload = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          dms: account.nostr.dms ?? []
        },
        null,
        2
      )
      await Share.share({
        message: payload,
        title: t('account.nostrSync.backupEvents')
      })
      toast.success(t('account.nostrSync.backupSuccess'))
    } catch {
      toast.error(t('account.nostrSync.backupError'))
    }
  }

  async function handleRequestDeletion() {
    if (
      !accountId ||
      !account?.nostr?.deviceNsec ||
      !account.nostr.relays?.length
    ) {
      toast.error(t('account.nostrSync.deletionError'))
      return
    }
    const deviceHex = getDevicePubkeyHex()
    if (!deviceHex) {
      toast.error(t('account.nostrSync.deletionError'))
      return
    }
    const ourEventIds = (account.nostr.dms ?? [])
      .filter(
        (dm) =>
          !dm.pending &&
          dm.author &&
          dm.author.toLowerCase() === deviceHex &&
          typeof dm.id === 'string' &&
          /^[a-f0-9]{64}$/i.test(dm.id)
      )
      .map((dm) => dm.id)
    if (ourEventIds.length === 0) {
      toast.info(t('account.nostrSync.noEventsToDelete'))
      setDeletionModalVisible(false)
      return
    }
    try {
      setIsLoading(true)
      const api = new NostrAPI(account.nostr.relays)
      await api.requestDeletion(ourEventIds, account.nostr.deviceNsec)
      await clearStoredDMs(account)
      updateAccountNostrCallback(accountId, { dms: [] })
      clearNostrState(accountId)
      clearProcessedMessageIds(accountId)
      clearProcessedEvents(accountId)
      setDeletionModalVisible(false)
      toast.success(t('account.nostrSync.deletionSuccess'))
    } catch {
      toast.error(t('account.nostrSync.deletionError'))
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

        if (accountId) stopSync(accountId)
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
          updatedAccount?.nostr?.relays &&
          updatedAccount.nostr.relays.length > 0
        ) {
          if (
            !updatedAccount.nostr.deviceNsec ||
            !updatedAccount.nostr.deviceNpub
          ) {
            toast.error('Missing required Nostr configuration')
          } else {
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
    stopSync,
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
        if (trustSyncRestartRef.current) {
          clearTimeout(trustSyncRestartRef.current)
        }
        const TRUST_SYNC_RESTART_DELAY_MS = 1500
        trustSyncRestartRef.current = setTimeout(() => {
          trustSyncRestartRef.current = null
          clearProcessedEvents(accountId)
          setLastDataExchangeEOSE(accountId, 0)
          const current = useAccountsStore
            .getState()
            .accounts.find((a) => a.id === accountId)
          if (current) {
            toast.info(t('account.nostrSync.resyncingAfterTrust'))
            setIsSyncing(true)
            setSyncing(accountId, true)
            restartSync(current, (loading) => {
              requestAnimationFrame(() => {
                setIsSyncing(loading)
                setSyncing(accountId, loading)
              })
            })
          }
        }, TRUST_SYNC_RESTART_DELAY_MS)
      }
    },
    [
      accountId,
      account?.nostr,
      clearProcessedEvents,
      restartSync,
      selectedMembers,
      setLastDataExchangeEOSE,
      setSyncing,
      updateAccountNostrCallback
    ]
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

  const handleCreateNewKey = useCallback(async () => {
    if (!accountId) return
    setIsGeneratingKeys(true)
    try {
      const keys = await NostrAPI.generateNostrKeys()
      if (!keys) return
      const current = useAccountsStore
        .getState()
        .accounts.find((a) => a.id === accountId)
      const nostrBase = current?.nostr ?? {
        autoSync: false,
        relays: [],
        dms: [],
        trustedMemberDevices: [],
        commonNsec: '',
        commonNpub: ''
      }
      updateAccountNostrCallback(accountId, {
        ...nostrBase,
        deviceNpub: keys.npub,
        deviceNsec: keys.nsec,
        lastUpdated: new Date()
      })
      setDeviceNsec(keys.nsec)
      setDeviceNpub(keys.npub)
      generateColorFromNpub(keys.npub).then(setDeviceColor)
    } catch {
      toast.error('Failed to generate device keys')
    } finally {
      setIsGeneratingKeys(false)
    }
  }, [accountId, updateAccountNostrCallback])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when common keys or account id change; omit full account to avoid re-run on ref change
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

    if (account.nostr.deviceNsec && account.nostr.deviceNpub && !deviceNpub) {
      setDeviceNsec(account.nostr.deviceNsec)
      setDeviceNpub(account.nostr.deviceNpub)
      generateColorFromNpub(account.nostr.deviceNpub).then(setDeviceColor)
    }
  }, [account, accountId, deviceNpub, updateAccountNostrCallback])

  useEffect(() => {
    if (displayDeviceNpub) {
      generateColorFromNpub(displayDeviceNpub).then(setDeviceColor)
    } else {
      setDeviceColor(NOSTR_FALLBACK_NPUB_COLOR)
    }
  }, [displayDeviceNpub])

  const hasNostr = !!account?.nostr
  const relayCount = account?.nostr?.relays?.length ?? 0
  useEffect(() => {
    const acc = useAccountsStore
      .getState()
      .accounts.find((a) => a.id === accountId)
    if (acc) loadNostrAccountData(acc)
  }, [accountId, hasNostr, relayCount, loadNostrAccountData])

  const relayKey = (account?.nostr?.relays ?? []).slice().sort().join(',')
  useEffect(() => {
    if (!account?.nostr?.autoSync || !account?.nostr?.relays?.length) return
    if (!accountId) return

    const current = useAccountsStore
      .getState()
      .accounts.find((a) => a.id === accountId)
    if (!current?.nostr) return

    restartSync(current, (loading) => {
      requestAnimationFrame(() => {
        setIsSyncing(loading)
        setSyncing(accountId, loading)
      })
    })
  }, [
    accountId,
    account?.nostr?.autoSync,
    account?.nostr?.relays?.length,
    relayKey,
    restartSync,
    setSyncing
  ])

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
                <SSText color="muted">{t(syncingMessage)}</SSText>
              </SSHStack>
            )}
            {!isSyncing && (
              <SSHStack gap="sm" style={{ justifyContent: 'center' }}>
                <SSText color="muted">
                  Last sync:{' '}
                  {lastProtocolEOSE
                    ? formatDateShort(lastProtocolEOSE)
                    : 'Never'}
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
                    {showDeviceKind0 && (
                      <SSVStack gap="xs" style={styles.deviceProfileRow}>
                        {deviceKind0Picture && (
                          <Image
                            source={{ uri: deviceKind0Picture }}
                            style={styles.deviceProfilePicture}
                            resizeMode="cover"
                          />
                        )}
                        {deviceKind0DisplayName && (
                          <SSText center size="lg">
                            {deviceKind0DisplayName}
                          </SSText>
                        )}
                      </SSVStack>
                    )}
                    <SSText color="muted" center>
                      {t('account.nostrSync.npub')}
                    </SSText>
                    <SSHStack gap="xs" style={styles.npubRow}>
                      <View
                        style={[
                          styles.deviceColorCircle,
                          { backgroundColor: deviceColor }
                        ]}
                      />
                      <SSTextClipboard
                        text={displayDeviceNpub || ''}
                        fullWidth={false}
                      >
                        <SSText
                          size="xl"
                          type="mono"
                          style={styles.keyText}
                          selectable
                        >
                          {`${displayDeviceNpub.slice(0, 12)}...${displayDeviceNpub.slice(-4)}`}
                        </SSText>
                      </SSTextClipboard>
                    </SSHStack>
                  </SSVStack>
                ) : isGeneratingKeys ? (
                  <SSHStack style={styles.keyContainerLoading}>
                    <ActivityIndicator color={Colors.white} />
                    <SSText uppercase color="white">
                      {t('account.nostrSync.loadingKeys')}
                    </SSText>
                  </SSHStack>
                ) : (
                  <SSText center color="muted">
                    {t('account.nostrSync.noNsec')}
                  </SSText>
                )}
              </SSVStack>
            </SSVStack>
            {!displayDeviceNsec && (
              <SSButton
                label={t('account.nostrSync.createNewKey')}
                onPress={handleCreateNewKey}
                disabled={isSyncing || isGeneratingKeys}
              />
            )}
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
                                    ?.picture ? (
                                    <Image
                                      source={{
                                        uri: account.nostr.npubProfiles[
                                          member.npub
                                        ].picture
                                      }}
                                      style={styles.memberAvatar}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View
                                      style={[
                                        styles.memberAvatarCircle,
                                        {
                                          backgroundColor:
                                            member.color ||
                                            NOSTR_FALLBACK_NPUB_COLOR
                                        }
                                      ]}
                                    />
                                  )}
                                  <SSVStack
                                    gap="xxs"
                                    style={styles.memberBlock}
                                  >
                                    <MemberNameBlock
                                      npub={member.npub}
                                      displayName={
                                        account?.nostr?.npubProfiles?.[
                                          member.npub
                                        ]?.displayName
                                      }
                                      alias={
                                        account?.nostr?.npubAliases?.[
                                          member.npub
                                        ]
                                      }
                                      hasPicture={
                                        !!account?.nostr?.npubProfiles?.[
                                          member.npub
                                        ]?.picture
                                      }
                                      memberColor={member.color}
                                    />
                                  </SSVStack>
                                </SSHStack>
                              </Pressable>
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
              label={t('account.nostrSync.clearCaches')}
              onPress={() => setClearCachesModalVisible(true)}
              disabled={isLoading}
              variant="subtle"
              style={{ flex: 1 }}
            />
          </SSHStack>
          <SSButton
            label={t('account.nostrSync.requestToDeletion')}
            onPress={() => setDeletionModalVisible(true)}
            disabled={isLoading || isSyncing}
            variant="subtle"
            style={{ marginTop: 12, marginBottom: 20 }}
          />
        </SSVStack>
      </ScrollView>
      <SSModal
        visible={deletionModalVisible}
        onClose={() => setDeletionModalVisible(false)}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.deletionModalContent}>
          <SSText center>
            {eventCount === 0
              ? t('account.nostrSync.deletionModalZeroEvents')
              : t('account.nostrSync.deletionModalMessage', {
                  count: eventCount
                })}
          </SSText>
          <SSVStack gap="xs" style={styles.deletionModalWarningRow}>
            <SSIconWarning
              height={20}
              width={20}
              fill="transparent"
              stroke={Colors.gray[400]}
            />
            <SSText center color="muted">
              {t('account.nostrSync.deletionModalRelayWarning')}
            </SSText>
          </SSVStack>
          <SSText center weight="bold">
            {t('account.nostrSync.deletionModalActionsPrompt')}
          </SSText>
          <SSVStack gap="sm">
            <SSButton
              label={t('account.nostrSync.backupEvents')}
              onPress={handleBackupEvents}
              variant="secondary"
              disabled={isLoading}
            />
            <SSButton
              label={t('account.nostrSync.requestDeletionConfirm')}
              onPress={handleRequestDeletion}
              variant="danger"
              disabled={isLoading}
            />
          </SSVStack>
        </SSVStack>
      </SSModal>
      <SSModal
        visible={clearCachesModalVisible}
        onClose={() => setClearCachesModalVisible(false)}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.deletionModalContent}>
          <SSVStack gap="xs" style={styles.deletionModalWarningRow}>
            <SSIconWarning
              height={20}
              width={20}
              fill="transparent"
              stroke={Colors.gray[400]}
            />
            <SSText center color="muted">
              {t('account.nostrSync.clearCachesModalMessage')}
            </SSText>
          </SSVStack>
          <SSButton
            label={t('account.nostrSync.clearCachesConfirm')}
            onPress={handleClearCaches}
            variant="danger"
            disabled={isLoading}
          />
        </SSVStack>
      </SSModal>
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
    borderRadius: 32,
    marginTop: 12
  },
  membersContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderColor: Colors.white,
    paddingVertical: 15,
    paddingLeft: 12
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
    width: 24,
    height: 24,
    borderRadius: 12
  },
  memberAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12
  },
  memberBlock: {
    gap: 0,
    flex: 1,
    marginLeft: 8
  },
  memberNpubRow: {
    alignItems: 'center',
    marginTop: 2
  },
  memberNpubUnderAlias: {
    letterSpacing: 1
  },
  memberColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  keyContainerLoading: {
    justifyContent: 'center',
    paddingVertical: 10
  },
  keyText: {
    letterSpacing: 1
  },
  npubRow: {
    alignSelf: 'center',
    alignItems: 'center'
  },
  deviceColorCircle: {
    width: 10,
    height: 10,
    borderRadius: 5
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
  },
  deletionModalContent: {
    paddingVertical: 8
  },
  deletionModalWarningRow: {
    alignItems: 'center'
  }
})
