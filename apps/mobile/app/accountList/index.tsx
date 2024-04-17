import { Stack, useRouter } from 'expo-router'
import { ScrollView, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import { i18n } from '@/locales'

export default function AccountList() {
  const router = useRouter()

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
          onPress={() => router.push('/addMasterKey/')}
        />
      </View>
      <SSMainLayout>
        <ScrollView />
      </SSMainLayout>
    </>
  )
}
