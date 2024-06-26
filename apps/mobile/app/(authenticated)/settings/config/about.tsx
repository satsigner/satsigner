import { Stack } from 'expo-router'
import { getBuildNumber, getVersion } from 'react-native-device-info'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'

export default function About() {
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{i18n.t('settings.about.title')}</SSText>
          ),
          headerLeft: () => <></>,
          headerRight: undefined
        }}
      />
      <SSMainLayout>
        <SSVStack>
          <SSHStack justifyBetween>
            <SSText uppercase>{i18n.t('common.version')}</SSText>
            <SSText>{`${getVersion()} (${getBuildNumber()})`}</SSText>
          </SSHStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
