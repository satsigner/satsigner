import { Stack, useRouter } from 'expo-router'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import { i18n } from '@/locales'

export default function App() {
  const router = useRouter()

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{i18n.t('satsigner.name')}</SSText>
          )
        }}
      />
      <SSButton
        label="Account List"
        onPress={() => router.push('/accountList/')}
      />
    </SSMainLayout>
  )
}