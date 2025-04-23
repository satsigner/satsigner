import { Stack } from 'expo-router'
import { Alert } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSSwitch from '@/components/SSSwitch'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useWalletsStore } from '@/store/wallets'

export default function Developer() {
  const deleteAccounts = useAccountsStore((state) => state.deleteAccounts)
  const deleteWallets = useWalletsStore((state) => state.deleteWallets)
  const [setFirstTime, skipPin, setSkipPin] = useAuthStore(
    useShallow((state) => [state.setFirstTime, state.skipPin, state.setSkipPin])
  )

  async function handleDeleteAccount() {
    deleteAccounts()
    deleteWallets()
    Alert.alert(t('settings.developer.accountsDeleted'))
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.developer.title')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSMainLayout>
        <SSVStack gap="lg">
          <SSVStack>
            <SSButton
              label={t('settings.developer.deleteAccounts')}
              onPress={() => handleDeleteAccount()}
            />
            <SSButton
              label={t('settings.developer.setPinFirstTime')}
              onPress={() => setFirstTime(true)}
            />
          </SSVStack>
          <SSSeparator color="gradient" />
          <SSVStack gap="none">
            <SSSwitch
              value={skipPin}
              textOn={t('settings.developer.skipPin')}
              textOff={t('settings.developer.skipPin')}
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
