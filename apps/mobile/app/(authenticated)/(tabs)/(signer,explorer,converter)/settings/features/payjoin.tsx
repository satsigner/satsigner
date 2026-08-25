import { Stack } from 'expo-router'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSCheckbox from '@/components/SSCheckbox'
import SSRadioButton from '@/components/SSRadioButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  PAYJOIN_DIRECTORY_URL,
  PAYJOIN_SESSION_TTL_PRESETS_MS
} from '@/constants/payjoin'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { type PayjoinCoordinationMode } from '@/types/payjoin'
import { PAYJOIN_COORDINATION_MODES } from '@/utils/payjoinMode'

const TTL_LABEL_KEYS: Record<number, string> = {
  [1 * 60 * 1000]: 'settings.payjoin.sessionTtl.oneMinute',
  [5 * 60 * 1000]: 'settings.payjoin.sessionTtl.fiveMinutes',
  [10 * 60 * 1000]: 'settings.payjoin.sessionTtl.tenMinutes'
}

const MODE_LABEL_KEYS: Record<PayjoinCoordinationMode, string> = {
  directory: 'settings.payjoin.mode.directory',
  manual: 'settings.payjoin.mode.manual'
}

const MODE_DESCRIPTION_KEYS: Record<PayjoinCoordinationMode, string> = {
  directory: 'settings.payjoin.mode.directoryDescription',
  manual: 'settings.payjoin.mode.manualDescription'
}

export default function PayjoinSettings() {
  const [
    payjoinEnabled,
    setPayjoinEnabled,
    payjoinCoordinationMode,
    setPayjoinCoordinationMode,
    payjoinDirectoryUrl,
    setPayjoinDirectoryUrl,
    payjoinSessionTtlMs,
    setPayjoinSessionTtlMs
  ] = useSettingsStore(
    useShallow((state) => [
      state.payjoinEnabled,
      state.setPayjoinEnabled,
      state.payjoinCoordinationMode,
      state.setPayjoinCoordinationMode,
      state.payjoinDirectoryUrl,
      state.setPayjoinDirectoryUrl,
      state.payjoinSessionTtlMs,
      state.setPayjoinSessionTtlMs
    ])
  )

  const isDirectory = payjoinCoordinationMode === 'directory'

  function handleTogglePayjoin() {
    setPayjoinEnabled(!payjoinEnabled)
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.payjoin.title')}</SSText>
          )
        }}
      />
      <SSMainLayout>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SSVStack gap="lg">
            <SSText color="muted">{t('settings.payjoin.description')}</SSText>
            <SSCheckbox
              label={t('settings.payjoin.enabled')}
              selected={payjoinEnabled}
              onPress={handleTogglePayjoin}
            />

            {payjoinEnabled ? (
              <SSVStack gap="lg">
                <SSVStack gap="sm">
                  <SSText uppercase>{t('settings.payjoin.mode.title')}</SSText>
                  <SSText color="muted" size="sm">
                    {t('settings.payjoin.mode.description')}
                  </SSText>
                  <SSVStack gap="sm">
                    {PAYJOIN_COORDINATION_MODES.map((mode) => (
                      <SSVStack key={mode} gap="xs">
                        <SSRadioButton
                          variant="outline"
                          label={t(MODE_LABEL_KEYS[mode])}
                          selected={payjoinCoordinationMode === mode}
                          onPress={() => setPayjoinCoordinationMode(mode)}
                        />
                        <SSText color="muted" size="sm">
                          {t(MODE_DESCRIPTION_KEYS[mode])}
                        </SSText>
                      </SSVStack>
                    ))}
                  </SSVStack>
                </SSVStack>

                {isDirectory ? (
                  <SSVStack gap="sm">
                    <SSText uppercase>
                      {t('settings.payjoin.directoryUrl.title')}
                    </SSText>
                    <SSText color="muted" size="sm">
                      {t('settings.payjoin.directoryUrl.description')}
                    </SSText>
                    <SSTextInput
                      align="left"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      placeholder={PAYJOIN_DIRECTORY_URL}
                      value={payjoinDirectoryUrl}
                      onChangeText={setPayjoinDirectoryUrl}
                    />
                  </SSVStack>
                ) : null}

                {isDirectory ? (
                  <SSVStack gap="sm">
                    <SSText uppercase>
                      {t('settings.payjoin.sessionTtl.title')}
                    </SSText>
                    <SSText color="muted" size="sm">
                      {t('settings.payjoin.sessionTtl.description')}
                    </SSText>
                    <SSVStack gap="xs">
                      {PAYJOIN_SESSION_TTL_PRESETS_MS.map((ttlMs) => (
                        <SSRadioButton
                          key={ttlMs}
                          variant="outline"
                          label={t(TTL_LABEL_KEYS[ttlMs] ?? '')}
                          selected={payjoinSessionTtlMs === ttlMs}
                          onPress={() => setPayjoinSessionTtlMs(ttlMs)}
                        />
                      ))}
                    </SSVStack>
                  </SSVStack>
                ) : null}
              </SSVStack>
            ) : null}
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
