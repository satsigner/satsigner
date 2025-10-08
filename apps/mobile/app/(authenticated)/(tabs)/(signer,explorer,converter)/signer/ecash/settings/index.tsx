import { Stack, useRouter } from 'expo-router'
import { Alert, ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

export default function EcashSettingsPage() {
  const router = useRouter()
  const { clearAllData, mints, proofs, transactions } = useEcash()

  const handleMintPress = () => {
    router.navigate('/signer/ecash/mint')
  }

  const handleBackupPress = () => {
    router.navigate('/signer/ecash/backup')
  }

  const handleRecoveryPress = () => {
    router.navigate('/signer/ecash/recovery')
  }

  const handleClearAllData = () => {
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
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('ecash.recovery.clear'),
          style: 'destructive',
          onPress: () => {
            clearAllData()
            router.back()
          }
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
            <SSText uppercase>{t('ecash.settings.mintManagement')}</SSText>
            <SSButton
              label={t('ecash.mint.title')}
              onPress={handleMintPress}
              variant="secondary"
            />
          </SSVStack>

          <SSVStack gap="sm">
            <SSText uppercase>{t('ecash.settings.dataManagement')}</SSText>
            <SSHStack gap="sm">
              <SSButton
                label={t('ecash.backup.title')}
                onPress={handleBackupPress}
                style={{ flex: 1 }}
              />
              <SSButton
                label={t('ecash.recovery.title')}
                onPress={handleRecoveryPress}
                style={{ flex: 1 }}
              />
            </SSHStack>
            <SSButton
              label={t('ecash.recovery.clearAllData')}
              onPress={handleClearAllData}
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
    paddingTop: 20,
    paddingBottom: 60
  }
})
