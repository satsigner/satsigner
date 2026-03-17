import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI } from '@/api/nostr'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import SSButton from '@/components/SSButton'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_FALLBACK_NPUB_COLOR } from '@/constants/nostr'
import useNostrSync from '@/hooks/useNostrSync'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import type { DeviceAliasSearchParams } from '@/types/navigation/searchParams'

export default function DeviceAliasPage() {
  const { id: accountId, npub } =
    useLocalSearchParams<DeviceAliasSearchParams>()

  const [account, updateAccountNostr] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((account) => account.id === accountId),
      state.updateAccountNostr
    ])
  )

  const [
    clearProcessedEvents,
    setLastDataExchangeEOSE,
    memberColor,
    globalProfile
  ] = useNostrStore(
    useShallow((state) => {
      const memberColorValue =
        !accountId || !npub
          ? NOSTR_FALLBACK_NPUB_COLOR
          : (() => {
              const accountMembers = state.members[accountId] || []
              const member = accountMembers.find(
                (m) => (typeof m === 'string' ? m : m.npub) === npub
              )
              if (!member) return NOSTR_FALLBACK_NPUB_COLOR
              return typeof member === 'string'
                ? NOSTR_FALLBACK_NPUB_COLOR
                : member.color
            })()
      return [
        state.clearProcessedEvents,
        state.setLastDataExchangeEOSE,
        memberColorValue,
        npub ? state.profiles[npub] : undefined
      ]
    })
  )

  const { restartSync } = useNostrSync()
  const trustSyncRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (trustSyncRestartRef.current) {
        clearTimeout(trustSyncRestartRef.current)
        trustSyncRestartRef.current = null
      }
    }
  }, [accountId])

  const accountProfile = npub ? account?.nostr?.npubProfiles?.[npub] : undefined
  const isThisDevice = npub === account?.nostr?.deviceNpub
  const deviceProfile = isThisDevice
    ? {
        displayName: account?.nostr?.deviceDisplayName,
        picture: account?.nostr?.devicePicture
      }
    : undefined
  const displayName =
    accountProfile?.displayName ??
    deviceProfile?.displayName ??
    globalProfile?.displayName
  const picture =
    accountProfile?.picture ?? deviceProfile?.picture ?? globalProfile?.picture
  const memberProfile =
    npub && (displayName || picture) ? { displayName, picture } : undefined

  const currentAlias =
    npub && account?.nostr?.npubAliases?.[npub]
      ? account.nostr.npubAliases[npub]
      : ''
  const [alias, setAlias] = useState(currentAlias)
  const [loadingFetchKind0, setLoadingFetchKind0] = useState(false)

  async function fetchKind0Profile() {
    if (loadingFetchKind0) return
    if (!npub || !accountId || !account?.nostr) {
      toast.error(t('account.nostrSync.fetchKind0NoRelay'))
      return
    }

    // Show feedback when sync off or no relays
    if (!account.nostr.autoSync) {
      toast.error(t('account.nostrSync.fetchKind0NoRelay'))
      return
    }
    const relays = account.nostr.relays ?? []
    if (relays.length === 0) {
      toast.error(t('account.nostrSync.fetchKind0NoRelay'))
      return
    }

    setLoadingFetchKind0(true)
    try {
      const api = new NostrAPI(relays)
      const profile = await api.fetchKind0(npub)
      if (profile && (profile.displayName || profile.picture)) {
        const updated = {
          ...(account.nostr.npubProfiles || {}),
          [npub]: {
            displayName: profile.displayName,
            picture: profile.picture
          }
        }
        const payload: Parameters<typeof updateAccountNostr>[1] = {
          npubProfiles: updated,
          lastUpdated: new Date()
        }
        if (npub === account.nostr.deviceNpub) {
          payload.deviceDisplayName = profile.displayName
          payload.devicePicture = profile.picture
        }
        updateAccountNostr(accountId, payload)
        toast.success(t('account.nostrSync.fetchKind0Success'))
      } else {
        toast.info(t('account.nostrSync.fetchKind0NotFound'))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const isNoRelay =
        message.includes('No relay') ||
        message.includes('relays could be connected') ||
        message.includes('relays are responding')
      toast.error(
        isNoRelay
          ? t('account.nostrSync.fetchKind0NoRelay')
          : t('account.nostrSync.fetchKind0Error')
      )
    } finally {
      setLoadingFetchKind0(false)
    }
  }

  function clearKind0Profile() {
    if (!accountId || !account?.nostr || !npub) return
    const profiles = { ...(account.nostr.npubProfiles || {}) }
    delete profiles[npub]
    const payload: Parameters<typeof updateAccountNostr>[1] = {
      npubProfiles: Object.keys(profiles).length > 0 ? profiles : undefined,
      lastUpdated: new Date()
    }
    if (npub === account.nostr.deviceNpub) {
      payload.deviceDisplayName = undefined
      payload.devicePicture = undefined
    }
    updateAccountNostr(accountId, payload)
    toast.success(t('account.nostrSync.clearKind0Success'))
  }

  useEffect(() => {
    const aliasValue =
      npub && account?.nostr?.npubAliases?.[npub]
        ? account.nostr.npubAliases[npub]
        : ''
    setAlias(aliasValue)
  }, [npub, account?.nostr?.npubAliases])

  function handleSave() {
    if (!accountId || !account?.nostr || !npub) return

    const updatedAliases = {
      ...(account.nostr.npubAliases || {}),
      ...(alias.trim() ? { [npub]: alias.trim() } : {})
    }

    if (!alias.trim() && updatedAliases[npub]) {
      delete updatedAliases[npub]
    }

    updateAccountNostr(accountId, {
      npubAliases:
        Object.keys(updatedAliases).length > 0 ? updatedAliases : undefined,
      lastUpdated: new Date()
    })

    toast.success(t('account.nostrSync.deviceAlias.aliasSaved'))
    router.back()
  }

  const isTrusted =
    account?.nostr?.trustedMemberDevices?.includes(npub ?? '') ?? false

  function handleTrustToggle() {
    if (!accountId || !account?.nostr || !npub) return

    if (isTrusted) {
      updateAccountNostr(accountId, {
        trustedMemberDevices: account.nostr.trustedMemberDevices.filter(
          (m) => m !== npub
        ),
        lastUpdated: new Date()
      })
      toast.success(t('account.nostrSync.deviceDistrusted'))
    } else {
      updateAccountNostr(accountId, {
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
        if (current) restartSync(current, () => {})
      }, TRUST_SYNC_RESTART_DELAY_MS)
      toast.success(t('account.nostrSync.deviceTrusted'))
    }
  }

  if (!accountId || !account || !npub) return <Redirect href="/" />

  return (
    <SSMainLayout style={styles.mainLayout}>
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
      <SSVStack style={styles.pageContainer} gap="lg">
        <SSVStack gap="lg">
          <SSVStack gap="sm">
            {memberProfile &&
              (memberProfile.displayName || memberProfile.picture) && (
                <SSVStack gap="xs" style={styles.profileRow}>
                  {memberProfile.picture && (
                    <Image
                      source={{ uri: memberProfile.picture }}
                      style={styles.profilePicture}
                      resizeMode="cover"
                    />
                  )}
                  {memberProfile.displayName && (
                    <SSText center size="lg">
                      {memberProfile.displayName}
                    </SSText>
                  )}
                </SSVStack>
              )}
            <SSText center color="muted">
              {t('account.nostrSync.npub')}
            </SSText>
            <SSHStack gap="xxs" style={styles.npubRow}>
              <View
                style={[styles.colorDot, { backgroundColor: memberColor }]}
              />
              <SSTextClipboard text={npub} fullWidth={false}>
                <SSText
                  size="xl"
                  type="mono"
                  selectable
                  style={styles.npubText}
                >
                  {`${npub.slice(0, 12)}...${npub.slice(-4)}`}
                </SSText>
              </SSTextClipboard>
            </SSHStack>
            <SSHStack gap="md" style={styles.kind0Row}>
              <SSButton
                variant="subtle"
                label={t('account.nostrSync.clearKind0')}
                onPress={clearKind0Profile}
                disabled={
                  !memberProfile?.displayName && !memberProfile?.picture
                }
                style={styles.saveClearButton}
              />
              <SSButton
                label={t('account.nostrSync.fetchKind0')}
                onPress={fetchKind0Profile}
                disabled={loadingFetchKind0}
                style={styles.saveClearButton}
              />
            </SSHStack>
            {loadingFetchKind0 && (
              <SSHStack gap="sm" style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#fff" />
                <SSText color="muted">
                  {t('account.nostrSync.fetchKind0Loading')}
                </SSText>
              </SSHStack>
            )}
          </SSVStack>
          <SSVStack gap="sm">
            <SSText center color="muted">
              {t('account.nostrSync.deviceAlias.alias')}
            </SSText>
            <SSTextInput
              value={alias}
              onChangeText={setAlias}
              placeholder={t('account.nostrSync.deviceAlias.aliasPlaceholder')}
            />
          </SSVStack>
          <SSHStack gap="md" style={styles.saveRemoveRow}>
            <SSButton
              variant="subtle"
              label={t('common.clear')}
              onPress={() => setAlias('')}
              disabled={!alias?.trim()}
              style={styles.saveClearButton}
            />
            <SSButton
              label={t('account.nostrSync.save')}
              onPress={handleSave}
              variant="secondary"
              disabled={alias.trim() === (currentAlias ?? '').trim()}
              style={styles.saveClearButton}
            />
          </SSHStack>
          <SSButton
            label={isTrusted ? 'Distrust' : 'Trust'}
            onPress={handleTrustToggle}
            variant={isTrusted ? 'danger' : 'outline'}
            style={styles.trustButton}
          />
          <SSButton
            variant="ghost"
            label={t('common.cancel')}
            onPress={() => router.back()}
            style={styles.cancelButton}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  mainLayout: {
    paddingTop: 10,
    paddingBottom: 20
  },
  pageContainer: {
    justifyContent: 'space-between',
    flex: 1
  },
  npubRow: {
    width: '100%',
    justifyContent: 'center'
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4
  },
  npubText: {
    letterSpacing: 1
  },
  profileRow: {
    alignItems: 'center',
    marginBottom: 4
  },
  profilePicture: {
    width: 64,
    height: 64,
    borderRadius: 32
  },
  loadingRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center'
  },
  trustButton: {
    alignSelf: 'stretch'
  },
  kind0Row: {
    alignSelf: 'stretch'
  },
  saveRemoveRow: {
    alignSelf: 'stretch'
  },
  saveClearButton: {
    flex: 1
  },
  cancelButton: {
    alignSelf: 'stretch',
    marginTop: 8
  }
})
