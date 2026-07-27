import { Stack } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import SSCheckbox from '@/components/SSCheckbox'
import SSRadioButton from '@/components/SSRadioButton'
import SSText from '@/components/SSText'
import { PAYJOIN_SESSION_TTL_PRESETS_MS } from '@/constants/payjoin'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'

const TTL_LABEL_KEYS: Record<number, string> = {
  [1 * 60 * 1000]: 'settings.payjoin.sessionTtl.oneMinute',
  [5 * 60 * 1000]: 'settings.payjoin.sessionTtl.fiveMinutes',
  [10 * 60 * 1000]: 'settings.payjoin.sessionTtl.tenMinutes'
}

export default function PayjoinSettings() {
  const [
    payjoinEnabled,
    setPayjoinEnabled,
    payjoinSessionTtlMs,
    setPayjoinSessionTtlMs
  ] = useSettingsStore(
    useShallow((state) => [
      state.payjoinEnabled,
      state.setPayjoinEnabled,
      state.payjoinSessionTtlMs,
      state.setPayjoinSessionTtlMs
    ])
  )

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
        <SSVStack gap="lg">
          <SSText color="muted">{t('settings.payjoin.description')}</SSText>
          <SSCheckbox
            label={t('settings.payjoin.enabled')}
            selected={payjoinEnabled}
            onPress={() => setPayjoinEnabled(!payjoinEnabled)}
          />
          <SSVStack gap="sm">
            <SSText uppercase>{t('settings.payjoin.sessionTtl.title')}</SSText>
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
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
