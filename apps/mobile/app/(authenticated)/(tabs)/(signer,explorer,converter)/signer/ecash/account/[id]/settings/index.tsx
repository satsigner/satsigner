import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { deleteEcashMnemonic } from '@/storage/encrypted'

export default function EcashAccountSettingsPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const {
    activeAccount,
    clearAccountData,
    removeAccount,
    renameAccount,
    mints,
    proofs,
    transactions
  } = useEcash()

  const [accountName, setAccountName] = useState(activeAccount?.name ?? '')

  function handleRename() {
    const trimmed = accountName.trim()
    if (!trimmed || !id) {
      return
    }
    renameAccount(id, trimmed)
    toast.success(t('ecash.account.renameSuccess'))
  }

  function handleClearData() {
    const hasData =
      mints.length > 0 || proofs.length > 0 || transactions.length > 0

    if (!hasData) {
      toast.info(t('ecash.recovery.noDataToClear'))
      return
    }

    Alert.alert(
      t('ecash.recovery.clearAllData'),
      t('ecash.recovery.clearAllDataWarning'),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          onPress: () => {
            clearAccountData()
            toast.success(t('ecash.success.dataCleared'))
          },
          style: 'destructive',
          text: t('ecash.recovery.clear')
        }
      ]
    )
  }

  function handleDeleteAccount() {
    Alert.alert(
      t('ecash.account.deleteAccount'),
      t('ecash.account.deleteAccountWarning'),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          onPress: async () => {
            if (id) {
              await deleteEcashMnemonic(id)
              removeAccount(id)
            }
            router.navigate('/signer/ecash')
          },
          style: 'destructive',
          text: t('common.delete')
        }
      ]
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ecash.settings.title')}</SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack style={styles.container} gap="lg">
          <SSVStack gap="sm">
            <SSText uppercase>{t('ecash.account.name')}</SSText>
            <SSTextInput
              value={accountName}
              onChangeText={setAccountName}
              placeholder={t('ecash.account.namePlaceholder')}
            />
            <SSButton
              label={t('ecash.account.rename')}
              onPress={handleRename}
              variant="outline"
              disabled={
                !accountName.trim() ||
                accountName.trim() === activeAccount?.name
              }
            />
          </SSVStack>

          <SSVStack gap="sm">
            <SSText uppercase>{t('ecash.settings.mintManagement')}</SSText>
            <SSButton
              label={t('ecash.mint.title')}
              onPress={() =>
                router.navigate(`/signer/ecash/account/${id}/settings/mint`)
              }
              variant="outline"
            />
          </SSVStack>

          {activeAccount?.hasSeed && (
            <SSVStack gap="sm">
              <SSText uppercase>{t('ecash.account.seedManagement')}</SSText>
              <SSButton
                label={t('ecash.account.viewSeedWords')}
                onPress={() =>
                  router.navigate(`/signer/ecash/account/${id}/settings/seed`)
                }
                variant="outline"
              />
              <SSButton
                label={t('ecash.account.restoreFromSeed')}
                onPress={() =>
                  router.navigate(
                    `/signer/ecash/account/${id}/settings/recovery`
                  )
                }
                variant="outline"
              />
            </SSVStack>
          )}

          <SSVStack gap="sm">
            <SSText uppercase>{t('ecash.settings.dataManagement')}</SSText>
            <SSHStack gap="sm">
              <SSButton
                label={t('ecash.backup.title')}
                onPress={() =>
                  router.navigate(`/signer/ecash/account/${id}/settings/backup`)
                }
                variant="outline"
                style={{ flex: 1 }}
              />
              <SSButton
                label={t('ecash.recovery.title')}
                onPress={() =>
                  router.navigate(
                    `/signer/ecash/account/${id}/settings/recovery`
                  )
                }
                variant="outline"
                style={{ flex: 1 }}
              />
            </SSHStack>
            <SSButton
              label={t('ecash.recovery.clearAllData')}
              onPress={handleClearData}
              variant="danger"
            />
          </SSVStack>

          <SSVStack gap="sm">
            <SSButton
              label={t('ecash.account.deleteAccount')}
              onPress={handleDeleteAccount}
              variant="danger"
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 60,
    paddingTop: 20
  }
})
