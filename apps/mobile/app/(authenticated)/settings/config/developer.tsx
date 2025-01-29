import { Stack } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'

import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSSwitch from '@/components/SSSwitch'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'

export default function Developer() {
  const deleteAccounts = useAccountsStore((state) => state.deleteAccounts)
  const [setFirstTime, skipPin, setSkipPin] = useAuthStore((state) => [
    state.setFirstTime,
    state.skipPin,
    state.setSkipPin
  ])

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
        <SSVStack gap="lg">
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
          <SSSeparator color="gradient" />
          <SSVStack gap="none">
            <SSSwitch
              value={skipPin}
              textOn="Skip Pin (ON)"
              textOff="Skip Pin (OFF)"
              size="lg"
              position="right"
              onToggle={() => setSkipPin(!skipPin)}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
