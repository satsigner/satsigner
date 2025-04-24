import { Stack } from 'expo-router'

import SSText from '@/components/SSText'
import { APP_VERSION, BUILD_NUMBER } from '@/constants/version'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

export default function About() {
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.about.title')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSMainLayout>
        <SSVStack>
          <SSHStack justifyBetween>
            <SSText uppercase>{t('common.version')}</SSText>
            <SSText>{`${APP_VERSION} (${BUILD_NUMBER})`}</SSText>
          </SSHStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
