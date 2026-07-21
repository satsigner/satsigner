import { Stack, useRouter } from 'expo-router'
import { TouchableOpacity } from 'react-native'

import { SSIconChevronRight } from '@/components/icons'
import SSText from '@/components/SSText'
import { APP_VERSION, BUILD_NUMBER } from '@/constants/version'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

export default function About() {
  const router = useRouter()

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.about.title')}</SSText>
          )
        }}
      />
      <SSMainLayout>
        <SSVStack gap="md">
          <SSHStack justifyBetween>
            <SSText uppercase>{t('common.version')}</SSText>
            <SSText>{`${APP_VERSION} (${BUILD_NUMBER})`}</SSText>
          </SSHStack>
          <TouchableOpacity
            activeOpacity={0.5}
            onPress={() => router.navigate('/settings/about/changelog')}
          >
            <SSHStack justifyBetween>
              <SSText uppercase>{t('settings.about.changelog.title')}</SSText>
              <SSIconChevronRight height={11.6} width={6} />
            </SSHStack>
          </TouchableOpacity>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
