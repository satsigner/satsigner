import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI } from '@/api/nostr'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import SSButton from '@/components/SSButton'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
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

  const memberColor = useNostrStore(
    useShallow((state) => {
      if (!accountId || !npub) return '#404040'
      const accountMembers = state.members[accountId] || []
      const member = accountMembers.find(
        (m) => (typeof m === 'string' ? m : m.npub) === npub
      )
      if (!member) return '#404040'
      return typeof member === 'string' ? '#404040' : member.color
    })
  )

  const memberProfile =
    npub && account?.nostr?.npubProfiles?.[npub]
      ? account.nostr.npubProfiles[npub]
      : undefined

  const currentAlias =
    npub && account?.nostr?.npubAliases?.[npub]
      ? account.nostr.npubAliases[npub]
      : ''
  const [alias, setAlias] = useState(currentAlias)
  const [loadingFetchKind0, setLoadingFetchKind0] = useState(false)

  async function fetchKind0Profile() {
    if (!npub || !accountId || !account?.nostr || loadingFetchKind0) return

    const t0 = performance.now()
    setLoadingFetchKind0(true)
    try {
      const relays =
        (account.nostr.relays?.length ?? 0) > 0
          ? account.nostr.relays ?? []
          : []
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
        updateAccountNostr(accountId, {
          npubProfiles: updated,
          lastUpdated: new Date()
        })
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
      console.log('[Nostr:Perf] device [npub] fetchKind0Profile', `${(performance.now() - t0).toFixed(0)}ms`)
      setLoadingFetchKind0(false)
    }
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

    toast.success('Alias saved')
    router.back()
  }

  function handleRemoveAlias() {
    if (!accountId || !account?.nostr || !npub) return

    const updatedAliases = { ...(account.nostr.npubAliases || {}) }
    delete updatedAliases[npub]

    updateAccountNostr(accountId, {
      npubAliases:
        Object.keys(updatedAliases).length > 0 ? updatedAliases : undefined,
      lastUpdated: new Date()
    })

    setAlias('')
    toast.success('Alias removed')
    router.back()
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
            <View style={styles.npubRowWrapper}>
              <SSHStack gap="xxs" style={styles.npubRow}>
                <View
                  style={[styles.colorDot, { backgroundColor: memberColor }]}
                />
                <SSTextClipboard text={npub}>
                  <SSText
                    size="xl"
                    type="mono"
                    selectable
                    style={styles.npubText}
                  >
                    {npub.slice(0, 12) + '...' + npub.slice(-4)}
                  </SSText>
                </SSTextClipboard>
              </SSHStack>
            </View>
            <SSButton
              label={t('account.nostrSync.fetchKind0')}
              onPress={fetchKind0Profile}
              disabled={loadingFetchKind0}
            />
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
          {alias.trim() && (
            <SSButton
              variant="danger"
              label={t('account.nostrSync.deviceAlias.removeAlias')}
              onPress={handleRemoveAlias}
            />
          )}
          <SSButton
            label={t('account.nostrSync.save')}
            onPress={handleSave}
            variant="secondary"
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
  npubRowWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  npubRow: {
    flexDirection: 'row',
    alignItems: 'center'
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
  }
})
