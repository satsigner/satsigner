import {
  Redirect,
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams
} from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  NOSTR_FALLBACK_NPUB_COLOR,
  NOSTR_SYNCING_MESSAGE_ROTATE_MS,
  NOSTR_TRUST_SYNC_RESTART_DELAY_MS
} from '@/constants/nostr'
import useNostrSync from '@/hooks/useNostrSync'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { Colors } from '@/styles'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatDateShort } from '@/utils/date'
import { generateColorFromNpub, getPubKeyHexFromNpub } from '@/utils/nostr'
import {
  getNostrErrorMessage,
  getNostrErrorMessageForCode
} from '@/utils/nostrErrorMessage'
import { generateDeviceNostrKeysFromSeed } from '@/utils/nostrIdentity'
import {
  checkRelayStatuses,
  countDisconnected,
  type NostrRelayCheckStatus
} from '@/utils/nostrRelayStatus'
import { nostrSyncService } from '@/utils/nostrSyncService'

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
      : (displayName ?? alias ?? null)
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
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const [account, updateAccountNostr] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccountNostr
    ])
  )

  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false)

  const clearNostrState = useNostrStore((state) => state.clearNostrState)
  const setSyncing = useNostrStore((state) => state.setSyncing)
  const lastProtocolEOSE = useNostrStore((state) =>
    accountId ? state.lastProtocolEOSE[accountId] : undefined
  )
  const syncState = useNostrStore((state) =>
    accountId ? state.syncStatus[accountId] : undefined
  )
  const syncErrorMessage =
    syncState?.status === 'error' && syncState.lastError
      ? getNostrErrorMessageForCode(syncState.lastError)
      : null

  const rawMembers = useNostrStore((state) =>
    accountId ? state.members[accountId] : undefined
  )

  const members = useMemo(() => {
    if (!rawMembers) {
      return []
    }
    return rawMembers
      .map((member) =>
        typeof member === 'string'
          ? { color: NOSTR_FALLBACK_NPUB_COLOR, npub: member }
          : member
      )
      .reduce<{ npub: string; color: string }[]>((acc, member) => {
        if (!acc.some((m) => m.npub === member.npub)) {
          acc.push(member)
        }
        return acc
      }, [])
  }, [rawMembers])

  const { clearStoredDMs, generateCommonNostrKeys, deviceAnnouncement } =
    useNostrSync()

  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [commonNsec, setCommonNsec] = useState('')
  const [deviceNsec, setDeviceNsec] = useState('')
  const [deviceNpub, setDeviceNpub] = useState('')
  const [deviceColor, setDeviceColor] = useState(NOSTR_FALLBACK_NPUB_COLOR)
  const [selectedRelays, setSelectedRelays] = useState<string[]>([])
  const [relayConnectionStatuses, setRelayConnectionStatuses] = useState<
    Record<string, NostrRelayCheckStatus>
  >({})
  const [deletionModalVisible, setDeletionModalVisible] = useState(false)
  const [clearCachesModalVisible, setClearCachesModalVisible] = useState(false)
  const [syncingMessageIndex, setSyncingMessageIndex] = useState(0)
  const syncingMessage = SYNCING_MESSAGE_KEYS[syncingMessageIndex]

  const [trustMemberModalVisible, setTrustMemberModalVisible] = useState(false)
  const [trustMember, setTrustMember] = useState('')

  useEffect(() => {
    if (!isSyncing) {
      setSyncingMessageIndex(0)
      return
    }
    const interval = setInterval(() => {
      setSyncingMessageIndex((i) =>
        i + 1 >= SYNCING_MESSAGE_KEYS.length ? 0 : i + 1
      )
    }, NOSTR_SYNCING_MESSAGE_ROTATE_MS)
    return () => clearInterval(interval)
  }, [isSyncing])

  const previousRelaysRef = useRef<string[]>([])
  const trustSyncRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (trustSyncRestartRef.current) {
        clearTimeout(trustSyncRestartRef.current)
        trustSyncRestartRef.current = null
      }
    },
    [accountId]
  )

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
  useFocusEffect(() => {
    if (
      !account?.nostr?.deviceNpub ||
      !account.nostr.deviceNsec ||
      account.nostr.deviceNpub === deviceNpub
    ) {
      return
    }
    setDeviceNsec(account.nostr.deviceNsec)
    setDeviceNpub(account.nostr.deviceNpub)
    setDeviceColor(generateColorFromNpub(account.nostr.deviceNpub))
  })

  async function testRelaySync(relays: string[]) {
    setRelayConnectionStatuses(
      Object.fromEntries(relays.map((relay) => [relay, 'connecting']))
    )
    const statuses = await checkRelayStatuses(relays)
    setRelayConnectionStatuses(statuses)

    const unreachable = countDisconnected(statuses)
    if (unreachable > 0) {
      toast.error(
        t('account.nostrSync.relaysUnreachable', {
          count: unreachable,
          total: relays.length
        })
      )
    }

    if (accountId) {
      updateAccountNostr(accountId, {
        lastUpdated: new Date(),
        relayStatuses: statuses
      })
    }
  }

  const getRelayConnectionInfo = (status: NostrRelayCheckStatus) => {
    switch (status) {
      case 'connected': {
        return {
          color: '#22c55e',
          text: t('account.nostrSync.relayStatusConnected')
        }
      }
      case 'connecting': {
        return {
          color: '#f59e0b',
          text: t('account.nostrSync.relayStatusConnecting')
        }
      }
      case 'disconnected': {
        return {
          color: '#ef4444',
          text: t('account.nostrSync.relayStatusDisconnected')
        }
      }
      default: {
        return {
          color: '#6b7280',
          text: t('account.nostrSync.relayStatusUnknown')
        }
      }
    }
  }

  /**
   * Full reset: stop sync, clear relays, DMs, Kind 0 data, and processed state.
   */
  const handleClearCaches = async () => {
    if (!accountId || !account?.nostr) {
      return
    }

    try {
      setIsLoading(true)
      setClearCachesModalVisible(false)
      await nostrSyncService.stopSync(accountId)
      clearStoredDMs(account)
      updateAccountNostr(accountId, {
        autoSync: false,
        deviceDisplayName: undefined,
        devicePicture: undefined,
        dms: [],
        npubAliases: undefined,
        npubProfiles: undefined,
        relays: [],
        syncStart: new Date(),
        trustedMemberDevices: []
      })
      clearNostrState(accountId)
      setSelectedMembers(new Set())
      setSelectedRelays([])
      setRelayConnectionStatuses({})
      previousRelaysRef.current = []
      toast.success(t('account.nostrSync.clearCachesSuccess'))
    } catch {
      toast.error(t('account.nostrSync.clearCachesError'))
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
          dms: account.nostr.dms ?? [],
          exportedAt: new Date().toISOString()
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

  function handleRequestDeletion() {
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
      api.requestDeletion(ourEventIds, account.nostr.deviceNsec)
      clearStoredDMs(account)
      updateAccountNostr(accountId, { dms: [] })
      clearNostrState(accountId)
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
  const loadNostrAccountData = (acc: NonNullable<typeof account>) => {
    if (!acc || !accountId) {
      return
    }

    if (!acc.nostr) {
      updateAccountNostr(accountId, {
        autoSync: false,
        commonNpub: '',
        commonNsec: '',
        deviceNpub: '',
        deviceNsec: '',
        dms: [],
        relays: [],
        trustedMemberDevices: []
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
  }

  function handleSyncLoadingChange(loading: boolean) {
    requestAnimationFrame(() => {
      setIsSyncing(loading)
      if (accountId) {
        setSyncing(accountId, loading)
      }
    })
  }

  async function turnSyncOff(relays: string[]) {
    if (!accountId) {
      return
    }
    setIsSyncing(true)
    setSyncing(accountId, true)
    await nostrSyncService.stopSync(accountId)

    const allRelaysDisconnected: Record<string, NostrRelayCheckStatus> =
      Object.fromEntries(relays.map((relay) => [relay, 'disconnected']))
    setRelayConnectionStatuses(allRelaysDisconnected)
    updateAccountNostr(accountId, {
      autoSync: false,
      lastUpdated: new Date(),
      relayStatuses: allRelaysDisconnected
    })
    setIsSyncing(false)
    setSyncing(accountId, false)
  }

  async function turnSyncOn() {
    if (!accountId) {
      return
    }
    // syncStart marks which DMs belong to this session (notifications).
    updateAccountNostr(accountId, {
      autoSync: true,
      lastUpdated: new Date(),
      syncStart: new Date()
    })
    const updatedAccount = useAccountsStore
      .getState()
      .accounts.find((a) => a.id === accountId)
    if (!updatedAccount?.nostr?.relays?.length) {
      return
    }
    if (!updatedAccount.nostr.deviceNsec || !updatedAccount.nostr.deviceNpub) {
      toast.error(t('common.error.missingRequiredNostrConfig'))
      return
    }

    setIsSyncing(true)
    setSyncing(accountId, true)
    try {
      await testRelaySync(updatedAccount.nostr.relays)
      void deviceAnnouncement(updatedAccount)
      await nostrSyncService.startSync(accountId, handleSyncLoadingChange)
    } catch (error) {
      toast.error(t('account.nostrSync.setupSyncFailed'), {
        description: getNostrErrorMessage(error)
      })
    } finally {
      setIsSyncing(false)
      setSyncing(accountId, false)
    }
  }

  async function handleToggleAutoSync() {
    if (!accountId || !account) {
      return
    }
    if (!account.nostr) {
      updateAccountNostr(accountId, {
        autoSync: false,
        commonNpub: '',
        commonNsec: '',
        deviceNpub: '',
        deviceNsec: '',
        dms: [],
        lastUpdated: new Date(),
        relays: [],
        syncStart: new Date(),
        trustedMemberDevices: []
      })
      return
    }
    try {
      if (account.nostr.autoSync) {
        await turnSyncOff(account.nostr.relays ?? [])
        return
      }
      await turnSyncOn()
    } catch (error) {
      toast.error(t('account.nostrSync.toggleSyncFailed'), {
        description: getNostrErrorMessage(error)
      })
      setIsSyncing(false)
      setSyncing(accountId, false)
    }
  }

  function showTrustMemberModal(npub: string) {
    setTrustMember(npub)
    setTrustMemberModalVisible(true)
  }

  function confirmTrustMember() {
    toggleMember(trustMember)
    setTrustMemberModalVisible(false)
  }

  async function finishTrustResync(id: string) {
    toast.info(t('account.nostrSync.resyncingAfterTrust'))
    setIsSyncing(true)
    setSyncing(id, true)
    await nostrSyncService.resyncDataExchangeAfterTrust(
      id,
      handleSyncLoadingChange
    )
    if (!nostrSyncService.hasActiveSubscription(id)) {
      setIsSyncing(false)
      setSyncing(id, false)
    }
  }

  const toggleMember = (npub: string) => {
    if (!accountId || !account?.nostr) {
      return
    }

    const isCurrentlyTrusted = selectedMembers.has(npub)

    if (isCurrentlyTrusted) {
      setSelectedMembers((prev) => {
        const newSet = new Set(prev)
        newSet.delete(npub)
        return newSet
      })

      updateAccountNostr(accountId, {
        lastUpdated: new Date(),
        trustedMemberDevices: account.nostr.trustedMemberDevices.filter(
          (m) => m !== npub
        )
      })
    } else {
      setSelectedMembers((prev) => new Set([...prev, npub]))

      updateAccountNostr(accountId, {
        lastUpdated: new Date(),
        trustedMemberDevices: [...account.nostr.trustedMemberDevices, npub]
      })
      if (trustSyncRestartRef.current) {
        clearTimeout(trustSyncRestartRef.current)
      }
      // Events from this device were skipped (and marked processed) while it
      // was untrusted, so the data-exchange history is fetched again.
      trustSyncRestartRef.current = setTimeout(() => {
        trustSyncRestartRef.current = null
        void finishTrustResync(accountId)
      }, NOSTR_TRUST_SYNC_RESTART_DELAY_MS)
    }
  }

  const handleToggleMember = (npub: string) => {
    if (!selectedMembers.has(npub)) {
      showTrustMemberModal(npub)
    } else {
      toggleMember(npub)
    }
  }

  const goToSelectRelaysPage = () => {
    if (!accountId) {
      return
    }
    router.push({
      params: { id: accountId },
      pathname: '/signer/bitcoin/account/[id]/settings/nostr/selectRelays'
    })
  }

  const goToNostrKeyPage = () => {
    if (!accountId) {
      return
    }
    router.push({
      params: { id: accountId },
      pathname: '/signer/bitcoin/account/[id]/settings/nostr/nostrKey'
    })
  }

  const goToDevicesGroupChat = () => {
    if (!accountId) {
      return
    }
    router.push({
      params: { id: accountId },
      pathname: '/signer/bitcoin/account/[id]/settings/nostr/devicesGroupChat'
    })
  }

  const handleCreateNewKey = () => {
    if (!accountId) {
      return
    }
    setIsGeneratingKeys(true)
    try {
      const keys = generateDeviceNostrKeysFromSeed()
      const current = useAccountsStore
        .getState()
        .accounts.find((a) => a.id === accountId)
      const nostrBase = current?.nostr ?? {
        autoSync: false,
        commonNpub: '',
        commonNsec: '',
        deviceNpub: '',
        deviceNsec: '',
        dms: [],
        lastUpdated: new Date(),
        relays: [],
        syncStart: new Date(),
        trustedMemberDevices: []
      }
      updateAccountNostr(accountId, {
        ...nostrBase,
        deviceMnemonic: keys.mnemonic,
        deviceNpub: keys.npub,
        deviceNsec: keys.nsec,
        lastUpdated: new Date()
      })
      setDeviceNsec(keys.nsec)
      setDeviceNpub(keys.npub)
      setDeviceColor(generateColorFromNpub(keys.npub))
    } catch {
      toast.error(t('account.nostrSync.errorGenerateDeviceKeys'))
    } finally {
      setIsGeneratingKeys(false)
    }
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
    if (!account || !accountId) {
      return
    }

    if (!account.nostr) {
      updateAccountNostr(accountId, {
        autoSync: false,
        commonNpub: '',
        commonNsec: '',
        deviceNpub: '',
        deviceNsec: '',
        dms: [],
        relays: [],
        trustedMemberDevices: []
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

    async function loadCommonKeys() {
      try {
        const keys = await generateCommonNostrKeys(account)
        if (keys && 'commonNsec' in keys && 'commonNpub' in keys) {
          setCommonNsec(keys.commonNsec)
          updateAccountNostr(accountId, {
            commonNpub: keys.commonNpub,
            commonNsec: keys.commonNsec
          })
        }
      } catch {
        toast.error(t('account.nostrSync.errorLoadingCommonKeys'))
      }
    }
    loadCommonKeys()

    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when common keys or account id change; omit full account to avoid re-run on ref change
  }, [])

  useEffect(() => {
    if (!account || !accountId) {
      return
    }

    if (!account.nostr) {
      updateAccountNostr(accountId, {
        autoSync: false,
        commonNpub: '',
        commonNsec: '',
        deviceNpub: '',
        deviceNsec: '',
        dms: [],
        relays: [],
        trustedMemberDevices: []
      })
      return
    }

    if (account.nostr.deviceNsec && account.nostr.deviceNpub && !deviceNpub) {
      setDeviceNsec(account.nostr.deviceNsec)
      setDeviceNpub(account.nostr.deviceNpub)
      setDeviceColor(generateColorFromNpub(account.nostr.deviceNpub))
    }
  }, [account, accountId, deviceNpub, updateAccountNostr])

  useEffect(() => {
    if (displayDeviceNpub) {
      setDeviceColor(generateColorFromNpub(displayDeviceNpub))
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
    if (acc) {
      loadNostrAccountData(acc)
    }
  }, [accountId, hasNostr, relayCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // startSync is idempotent: it only resubscribes when relays or keys
  // differ from the running sync, so revisiting this screen costs nothing.
  const syncConfigKey = [
    account?.nostr?.autoSync,
    account?.nostr?.commonNpub,
    account?.nostr?.deviceNpub,
    ...(account?.nostr?.relays ?? []).toSorted()
  ].join('|')
  useEffect(() => {
    if (!accountId) {
      return
    }
    void nostrSyncService.startSync(accountId)
  }, [accountId, syncConfigKey])

  if (!accountId || !account) {
    return <Redirect href="/" />
  }

  return (
    <SSMainLayout style={{ paddingBottom: 20, paddingTop: 10 }}>
      <ScrollView>
        <Stack.Screen
          options={{
            headerRight: () => null,
            headerTitle: () => (
              <SSHStack gap="sm">
                <SSText uppercase>{account.name}</SSText>
                {account.policyType === 'watchonly' && (
                  <SSIconEyeOn stroke="#fff" height={16} width={16} />
                )}
              </SSHStack>
            )
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
                account?.nostr?.autoSync
                  ? t('account.nostrSync.turnSyncOff')
                  : t('account.nostrSync.turnSyncOn')
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
              <SSVStack gap="xxs" style={styles.syncStatusBlock}>
                <SSText color="muted" center size="sm">
                  {lastProtocolEOSE
                    ? t('account.nostrSync.lastSync', {
                        date: formatDateShort(lastProtocolEOSE)
                      })
                    : t('account.nostrSync.lastSyncNever')}
                </SSText>
                {syncErrorMessage && (
                  <SSText center size="sm" style={styles.syncErrorText}>
                    {syncErrorMessage}
                  </SSText>
                )}
              </SSVStack>
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
              style={{ marginBottom: 10, marginTop: 30 }}
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
                                    params: {
                                      id: accountId,
                                      npub: member.npub
                                    },
                                    pathname:
                                      '/signer/bitcoin/account/[id]/settings/nostr/device/[npub]'
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
                                flex: 0.25,
                                height: 44
                              }}
                              variant={
                                selectedMembers.has(member.npub)
                                  ? 'danger'
                                  : 'outline'
                              }
                              label={
                                selectedMembers.has(member.npub)
                                  ? t('account.nostrSync.distrust')
                                  : t('account.nostrSync.trust')
                              }
                              onPress={() => {
                                handleToggleMember(member.npub)
                              }}
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
                  {selectedRelays.map((relay) => {
                    const status =
                      relayConnectionStatuses[relay] || 'disconnected'
                    const statusInfo = getRelayConnectionInfo(status)

                    return (
                      <SSHStack
                        key={relay}
                        gap="sm"
                        style={styles.relayStatusItem}
                      >
                        <View
                          style={{
                            backgroundColor: statusInfo.color,
                            borderRadius: 4,
                            height: 8,
                            marginRight: 8,
                            marginTop: 1,
                            width: 8
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
            style={{ marginBottom: 20, marginTop: 12 }}
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
      <SSModal
        visible={trustMemberModalVisible}
        onClose={() => setTrustMemberModalVisible(false)}
        showLabel={false}
        fullOpacity
      >
        <SSVStack
          style={{
            flex: 1,
            height: '100%',
            justifyContent: 'center'
          }}
        >
          <SSText center size="md">
            {t('account.nostrSync.memberConfirmNew')}
          </SSText>
          <SSButton onPress={confirmTrustMember} label={t('common.yes')} />
          <SSButton
            onPress={() => setTrustMemberModalVisible(false)}
            label={t('common.cancel')}
            variant="secondary"
          />
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  autoSyncContainer: {
    marginBottom: 10
  },
  colorCircle: {
    borderRadius: 6,
    height: 12,
    marginRight: 4,
    width: 12
  },
  deletionModalContent: {
    paddingVertical: 8
  },
  deletionModalWarningRow: {
    alignItems: 'center'
  },
  deviceColorCircle: {
    borderRadius: 5,
    height: 10,
    width: 10
  },
  deviceProfilePicture: {
    borderRadius: 32,
    height: 64,
    marginTop: 12,
    width: 64
  },
  deviceProfileRow: {
    alignItems: 'center',
    marginBottom: 4
  },
  keyContainerLoading: {
    justifyContent: 'center',
    paddingVertical: 10
  },
  keyText: {
    letterSpacing: 1
  },
  keysContainer: {
    backgroundColor: '#1a1a1a',
    borderColor: Colors.white,
    borderRadius: 8,
    padding: 10,
    paddingBottom: 30,
    paddingHorizontal: 28
  },
  memberAvatar: {
    borderRadius: 12,
    height: 24,
    width: 24
  },
  memberAvatarCircle: {
    borderRadius: 12,
    height: 24,
    width: 24
  },
  memberBlock: {
    flex: 1,
    gap: 0,
    marginLeft: 8
  },
  memberColorDot: {
    borderRadius: 4,
    height: 8,
    width: 8
  },
  memberNpubRow: {
    alignItems: 'center',
    marginTop: 2
  },
  memberNpubText: {
    color: Colors.gray[400],
    letterSpacing: 1
  },
  memberNpubUnderAlias: {
    letterSpacing: 1
  },
  memberRow: {
    alignItems: 'center'
  },
  memberText: {
    color: Colors.white,
    letterSpacing: 1,
    marginBottom: -4
  },
  membersContainer: {
    backgroundColor: '#1a1a1a',
    borderColor: Colors.white,
    borderRadius: 8,
    paddingLeft: 12,
    paddingVertical: 15
  },
  npubRow: {
    alignItems: 'center',
    alignSelf: 'center'
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
  syncErrorText: {
    color: Colors.error
  },
  syncStatusBlock: {
    alignItems: 'center'
  }
})
