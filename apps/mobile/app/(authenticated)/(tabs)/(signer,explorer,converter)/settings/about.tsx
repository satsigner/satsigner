import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { APP_VERSION, BUILD_NUMBER } from '@/constants/version'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useIntroStore } from '@/store/intro'
import { Colors } from '@/styles'

export default function About() {
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
      <SSMainLayout>
        <SSVStack>
          <SSHStack justifyBetween>
            <SSText uppercase>{t('common.version')}</SSText>
            <SSText>{`${APP_VERSION} (${BUILD_NUMBER})`}</SSText>
          </SSHStack>

          <View style={styles.separator} />

          <SSText size="xs" color="muted" uppercase style={styles.sectionLabel}>
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
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 8
  },
  separator: {
    backgroundColor: Colors.gray[800],
    height: 1,
    marginVertical: 8
  }
})
