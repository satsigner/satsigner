import { Stack } from 'expo-router'
import { toast } from 'sonner-native'
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
  const [skipPin, setSkipPin] = useAuthStore(
    useShallow((state) => [state.skipPin, state.setSkipPin])
  )

  async function handleDeleteAccount() {
    deleteAccounts()
    deleteWallets()
    toast.error(t('settings.developer.accountsDeleted'))
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
