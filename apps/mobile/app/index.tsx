import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'

export default function App() {
  const router = useRouter()
  const accountStore = useAccountStore()

  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [deletingAccounts, setDeletingAccounts] = useState(false)

  async function handleAccountList() {
    setLoadingAccounts(true)
    await accountStore.loadAccountsFromStorage()
    setLoadingAccounts(false)
    router.navigate('/accountList/')
  }

  async function handleDeleteAccount() {
    setDeletingAccounts(true)
    await accountStore.deleteAccounts()
    setDeletingAccounts(false)
    Alert.alert('Accounts deleted')
  }

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
          loading={loadingAccounts}
          onPress={() => handleAccountList()}
        />
        <SSButton
          label="Delete Accounts"
          loading={deletingAccounts}
          onPress={() => handleDeleteAccount()}
        />
      </SSVStack>
    </SSMainLayout>
  )
}
