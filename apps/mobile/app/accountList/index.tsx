import { Stack, useRouter } from 'expo-router'
import { ScrollView, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import SSVStack from '@/layouts/SSVStack'

export default function AccountList() {
  const router = useRouter()
  const accountStore = useAccountStore()

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{i18n.t('satsigner.name')}</SSText>
          )
        }}
      />
      <View>
        <SSButton
          label={i18n.t('addMasterKey.title')}
          style={{ borderRadius: 0 }}
          onPress={() => router.push('/addMasterKey/')}
        />
      </View>
      <SSMainLayout style={{ paddingHorizontal: '5%' }}>
        <ScrollView>
          {accountStore.accounts.length === 0 && (
            <SSVStack itemsCenter>
              <SSText color="muted" uppercase>
                {i18n.t('accountList.noKeysYet')}
              </SSText>
            </SSVStack>
          )}
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
