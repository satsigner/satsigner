import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import SSAccountCard from '@/components/SSAccountCard'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'

export default function AccountList() {
  const router = useRouter()
  const accountStore = useAccountStore()

  function handleOnPressAccount(account: Account) {
    accountStore.currentAccount = account
    router.navigate(`/account/${account.name}`)
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{i18n.t('satsigner.name')}</SSText>
          )
        }}
      />
      <SSButton
        label={i18n.t('addMasterKey.title')}
        variant="gradient"
        style={{ borderRadius: 0 }}
        onPress={() => router.navigate('/addMasterKey/')}
      />
      <SSMainLayout style={{ paddingHorizontal: '5%' }}>
        <ScrollView>
          {accountStore.accounts.length === 0 && (
            <SSVStack itemsCenter>
              <SSText color="muted" uppercase>
                {i18n.t('accountList.noKeysYet')}
              </SSText>
            </SSVStack>
          )}
          {accountStore.accounts.map((account) => (
            <SSAccountCard
              account={account}
              key={account.name}
              onPress={() => handleOnPressAccount(account)}
            />
          ))}
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
