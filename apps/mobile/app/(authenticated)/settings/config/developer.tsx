import { Stack } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'

export default function Developer() {
  const [deleteAccounts] = useAccountStore(
    useShallow((state) => [state.deleteAccounts])
  )
  const [setFirstTime] = useAuthStore(
    useShallow((state) => [state.setFirstTime])
  )

  const [deletingAccounts, setDeletingAccounts] = useState(false)

  async function handleDeleteAccount() {
    setDeletingAccounts(true)
    await deleteAccounts()
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
            onPress={() => setFirstTime(true)}
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
