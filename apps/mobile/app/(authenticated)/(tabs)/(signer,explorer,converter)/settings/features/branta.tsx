import { Stack } from 'expo-router'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { type BrantaLookupMode } from '@/types/models/Branta'

const LOOKUP_MODES: BrantaLookupMode[] = ['off', 'manual', 'always']

const MODE_LABELS: Record<BrantaLookupMode, string> = {
  always: 'settings.branta.modeAlways',
  manual: 'settings.branta.modeManual',
  off: 'settings.branta.modeOff'
}

const MODE_DESCRIPTIONS: Record<BrantaLookupMode, string> = {
  always: 'settings.branta.modeAlwaysDescription',
  manual: 'settings.branta.modeManualDescription',
  off: 'settings.branta.modeOffDescription'
}

export default function BrantaSettings() {
  const [
    brantaLookupMode,
    setBrantaLookupMode,
    brantaLabelSyncEnabled,
    setBrantaLabelSyncEnabled,
    brantaTorEnabled,
    setBrantaTorEnabled
  ] = useSettingsStore(
    useShallow((state) => [
      state.brantaLookupMode,
      state.setBrantaLookupMode,
      state.brantaLabelSyncEnabled,
      state.setBrantaLabelSyncEnabled,
      state.brantaTorEnabled,
      state.setBrantaTorEnabled
    ])
  )

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
            {LOOKUP_MODES.map((mode) => (
              <SSCheckbox
                key={mode}
                description={t(MODE_DESCRIPTIONS[mode])}
                label={t(MODE_LABELS[mode])}
                selected={brantaLookupMode === mode}
                onPress={() => setBrantaLookupMode(mode)}
              />
            ))}
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
