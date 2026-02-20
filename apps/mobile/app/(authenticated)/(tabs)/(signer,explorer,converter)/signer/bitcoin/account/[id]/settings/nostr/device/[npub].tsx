import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

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

  const currentAlias =
    npub && account?.nostr?.npubAliases?.[npub]
      ? account.nostr.npubAliases[npub]
      : ''
  const [alias, setAlias] = useState(currentAlias)

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
            <SSText center color="muted">
              {t('account.nostrSync.npub')}
            </SSText>
            <SSTextClipboard text={npub}>
              <SSText center size="lg" type="mono" selectable>
                {npub}
              </SSText>
            </SSTextClipboard>
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
  }
})
