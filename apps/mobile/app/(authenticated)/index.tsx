import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import SSAccountCard from '@/components/SSAccountCard'
import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'

export default function AccountList() {
  const router = useRouter()
  const accounts = useAccountsStore((state) => state.accounts)

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
      <SSMainLayout style={{ paddingHorizontal: '5%', paddingTop: 16 }}>
        <ScrollView>
          {accounts.length === 0 && (
            <SSVStack itemsCenter>
              <SSText color="muted" uppercase>
                {i18n.t('accountList.noKeysYet')}
              </SSText>
            </SSVStack>
          )}
          <SSVStack>
            {accounts.map((account) => (
              <SSVStack key={account.name}>
                <SSAccountCard
                  account={account}
                  onPress={() => router.navigate(`/account/${account.name}`)}
                />
                <SSSeparator color="gradient" />
              </SSVStack>
            ))}
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
