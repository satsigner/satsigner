import { Stack } from 'expo-router'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'

export default function BrantaSettings() {
  const [
    brantaLookupEnabled,
    setBrantaLookupEnabled,
    brantaLabelSyncEnabled,
    setBrantaLabelSyncEnabled,
    brantaTorEnabled,
    setBrantaTorEnabled
  ] = useSettingsStore(
    useShallow((state) => [
      state.brantaLookupEnabled,
      state.setBrantaLookupEnabled,
      state.brantaLabelSyncEnabled,
      state.setBrantaLabelSyncEnabled,
      state.brantaTorEnabled,
      state.setBrantaTorEnabled
    ])
  )

  function handleToggleLookup() {
    setBrantaLookupEnabled(!brantaLookupEnabled)
  }

  function handleToggleLabels() {
    setBrantaLabelSyncEnabled(!brantaLabelSyncEnabled)
  }

  function handleToggleTor() {
    setBrantaTorEnabled(!brantaTorEnabled)
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.branta.title')}</SSText>
          )
        }}
      />
      <SSMainLayout>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SSVStack gap="lg">
            <SSText color="muted">{t('settings.branta.description')}</SSText>
            <SSCheckbox
              description={t('settings.branta.lookupDescription')}
              label={t('settings.branta.lookup')}
              selected={brantaLookupEnabled}
              onPress={handleToggleLookup}
            />
            <SSCheckbox
              description={t('settings.branta.labelsDescription')}
              label={t('settings.branta.labels')}
              selected={brantaLabelSyncEnabled}
              onPress={handleToggleLabels}
            />
            <SSCheckbox
              description={t('settings.branta.torDescription')}
              label={t('settings.branta.tor')}
              selected={brantaTorEnabled}
              onPress={handleToggleTor}
            />
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
