import { Stack } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'

export default function Developer() {
  const accountStore = useAccountStore()
  const authStore = useAuthStore()

  const [deletingAccounts, setDeletingAccounts] = useState(false)

  async function handleDeleteAccount() {
    setDeletingAccounts(true)
    await accountStore.deleteAccounts()
    setDeletingAccounts(false)
    Alert.alert('Accounts deleted')
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{i18n.t('settings.developer.title')}</SSText>
          ),
          headerBackVisible: true,
          headerLeft: () => <></>,
          headerRight: undefined
        }}
      />
      <SSMainLayout>
        <SSVStack>
          <SSButton
            label="Delete Accounts"
            loading={deletingAccounts}
            onPress={() => handleDeleteAccount()}
          />
          <SSButton
            label="Set PIN First Time"
            onPress={() => authStore.setFirstTime(true)}
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
