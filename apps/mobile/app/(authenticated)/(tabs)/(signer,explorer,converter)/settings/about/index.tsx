import { Stack, useRouter } from 'expo-router'
import { TouchableOpacity } from 'react-native'

import { SSIconChevronRight, SSIconNostr, SSIconX } from '@/components/icons'
import SSText from '@/components/SSText'
import { APP_LICENSE, APP_VERSION, BUILD_NUMBER } from '@/constants/version'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { openUrl } from '@/utils/url'

const NOSTR_PROFILE_URL =
  'https://njump.me/npub1dhfmwt3jtknnswe8tmh3cesnrwjxvsexu93tcps9yagfkn3n4epsa3d8yn'
const X_PROFILE_URL = 'https://x.com/satsigner'

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
      <SSMainLayout style={{ paddingBottom: 40 }}>
        <SSVStack gap="md" justifyBetween>
          <SSVStack gap="md">
            <SSHStack justifyBetween>
              <SSText uppercase>{t('common.version')}</SSText>
              <SSText>{`${APP_VERSION} (${BUILD_NUMBER})`}</SSText>
            </SSHStack>
            <SSHStack justifyBetween>
              <SSText uppercase>{t('settings.about.license')}</SSText>
              <SSText>{APP_LICENSE}</SSText>
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
          <SSVStack gap="sm" itemsCenter>
            <SSText size="md" uppercase>
              {t('settings.about.followProject')}
            </SSText>
            <SSVStack gap="sm">
              <TouchableOpacity
                activeOpacity={0.5}
                onPress={() => openUrl(NOSTR_PROFILE_URL)}
              >
                <SSHStack gap="sm">
                  <SSIconNostr width={16} height={16} />
                  <SSText>{t('settings.about.nostr')}</SSText>
                </SSHStack>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.5}
                onPress={() => openUrl(X_PROFILE_URL)}
              >
                <SSHStack gap="sm">
                  <SSIconX width={16} height={16} />
                  <SSText>{t('settings.about.x')}</SSText>
                </SSHStack>
              </TouchableOpacity>
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
