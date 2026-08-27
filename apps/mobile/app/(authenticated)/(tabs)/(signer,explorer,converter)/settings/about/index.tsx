import { Stack, useRouter } from 'expo-router'
import { StyleSheet, TouchableOpacity } from 'react-native'

import { SSIconChevronRight, SSIconNostr, SSIconX } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import { APP_LICENSE, APP_VERSION, BUILD_NUMBER } from '@/constants/version'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useIntroStore } from '@/store/intro'
import { openUrl } from '@/utils/url'

const NOSTR_PROFILE_URL =
  'https://njump.me/npub1dhfmwt3jtknnswe8tmh3cesnrwjxvsexu93tcps9yagfkn3n4epsa3d8yn'
const X_PROFILE_URL = 'https://x.com/satsigner'

export default function About() {
  const router = useRouter()
  const showIntro = useIntroStore((state) => state.showIntro)

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
            <TouchableOpacity
              activeOpacity={0.5}
              onPress={() => router.navigate('/settings/securityReport')}
            >
              <SSHStack justifyBetween>
                <SSText uppercase>
                  {t('settings.about.securityReport.title')}
                </SSText>
                <SSIconChevronRight height={11.6} width={6} />
              </SSHStack>
            </TouchableOpacity>
            <SSSeparator />
            <SSText
              size="xs"
              color="muted"
              uppercase
              style={styles.sectionLabel}
            >
              {t('intro.sectionTitle')}
            </SSText>
            <SSHStack justifyBetween style={styles.chapterRow}>
              <SSText>{t('intro.replay')}</SSText>
              <SSButton
                variant="secondary"
                label={t('intro.start')}
                onPress={() => showIntro(true)}
                style={styles.chapterButton}
              />
            </SSHStack>
          </SSVStack>
          <SSVStack gap="sm" itemsCenter>
            <SSText size="md" uppercase>
              {t('settings.about.followProject')}
            </SSText>
            <SSHStack gap="lg">
              <TouchableOpacity
                activeOpacity={0.5}
                onPress={() => openUrl(NOSTR_PROFILE_URL)}
              >
                <SSHStack gap="sm" style={styles.followLink}>
                  <SSIconNostr width={16} height={16} />
                  <SSText>{t('settings.about.nostr')}</SSText>
                </SSHStack>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.5}
                onPress={() => openUrl(X_PROFILE_URL)}
              >
                <SSHStack gap="sm" style={styles.followLink}>
                  <SSIconX width={16} height={16} />
                  <SSText>{t('settings.about.x')}</SSText>
                </SSHStack>
              </TouchableOpacity>
            </SSHStack>
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  chapterButton: {
    height: 30,
    width: 72
  },
  chapterRow: {
    alignItems: 'center',
    paddingVertical: 4
  },
  followLink: {
    alignItems: 'center'
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 8
  }
})
