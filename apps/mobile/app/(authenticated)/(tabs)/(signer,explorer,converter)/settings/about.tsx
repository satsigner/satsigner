import { Stack } from 'expo-router'
import { ScrollView, StyleSheet } from 'react-native'

import CHANGELOG from '@/CHANGELOG.md'
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
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.about.title')}</SSText>
          )
        }}
      />
      <SSMainLayout>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <SSVStack gap="lg">
            <SSHStack justifyBetween>
              <SSText uppercase>{t('common.version')}</SSText>
              <SSText>{`${APP_VERSION} (${BUILD_NUMBER})`}</SSText>
            </SSHStack>
            <SSVStack gap="sm">
              <SSText uppercase weight="bold">
                {t('settings.about.changeLog')}
              </SSText>
              <SSText type="mono" size="xs" color="muted">
                {CHANGELOG}
              </SSText>
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 64
  }
})
