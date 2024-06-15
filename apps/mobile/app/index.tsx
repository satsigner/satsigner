import { Redirect, Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'

export default function App() {
  const router = useRouter()
  const authStore = useAuthStore()
  const accountStore = useAccountStore()

  const [deletingAccounts, setDeletingAccounts] = useState(false)

  async function handleDeleteAccount() {
    setDeletingAccounts(true)
    await accountStore.deleteAccounts()
    setDeletingAccounts(false)
    Alert.alert('Accounts deleted')
  }

  if (authStore.firstTime) return <Redirect href="/auth/init" />

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{i18n.t('satsigner.name')}</SSText>
          )
        }}
      />
      <SSVStack>
        <SSButton
          label="Account List"
          onPress={() => router.navigate('/accountList/')}
        />
        <SSButton
          label="Delete Accounts"
          loading={deletingAccounts}
          onPress={() => handleDeleteAccount()}
        />
        <SSButton
          label="Configure Blockchain"
          onPress={() => router.navigate('/settings/configureBlockchain')}
        />
        <SSButton
          label="Set PIN First Time"
          onPress={() => authStore.setFirstTime(true)}
        />
      </SSVStack>
    </SSMainLayout>
  )
}
