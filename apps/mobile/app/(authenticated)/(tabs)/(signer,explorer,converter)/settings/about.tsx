import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import { APP_VERSION, BUILD_NUMBER } from '@/constants/version'
import { useTourNavigation } from '@/hooks/useTourNavigation'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useTourStore } from '@/store/tour'
import { Colors } from '@/styles'

export default function About() {
  const { handleRestartTour } = useTourNavigation()
  const neverAskAgain = useTourStore((state) => state.neverAskAgain)
  const setTourPrompts = useTourStore((state) => state.setTourPrompts)

  function handleStartChapter1() {
    handleRestartTour()
  }

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
            {t('tour.about.sectionTitle')}
          </SSText>

          <SSHStack justifyBetween style={styles.chapterRow}>
            <SSText>{t('tour.chapters.one.title')}</SSText>
            <SSButton
              variant="secondary"
              label={t('tour.about.start')}
              onPress={handleStartChapter1}
              style={styles.chapterButton}
            />
          </SSHStack>

          {(['two', 'three', 'four', 'five', 'six', 'seven'] as const).map(
            (chapter) => (
              <SSHStack
                key={chapter}
                justifyBetween
                style={[styles.chapterRow, styles.chapterRowDisabled]}
              >
                <SSText color="muted">
                  {t(`tour.chapters.${chapter}.title`)}
                </SSText>
                <SSText size="xs" color="muted">
                  {t('tour.about.comingSoon')}
                </SSText>
              </SSHStack>
            )
          )}

          <SSCheckbox
            label={t('tour.about.showPrompts')}
            selected={!neverAskAgain}
            onPress={() => setTourPrompts(neverAskAgain)}
            labelProps={{ size: 'md' }}
          />
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
  chapterRowDisabled: {
    opacity: 0.4
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
