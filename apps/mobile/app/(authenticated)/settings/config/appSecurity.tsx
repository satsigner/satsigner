import { Stack } from 'expo-router'

import SSText from '@/components/SSText'
import { i18n } from '@/locales'

export default function AppSecurity() {
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{i18n.t('settings.appSecurity.title')}</SSText>
          ),
          headerLeft: () => <></>,
          headerRight: undefined
        }}
      />
    </>
  )
}
