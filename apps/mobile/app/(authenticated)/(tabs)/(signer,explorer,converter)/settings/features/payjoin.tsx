import { Stack } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'

export default function PayjoinSettings() {
  const [payjoinEnabled, setPayjoinEnabled] = useSettingsStore(
    useShallow((state) => [state.payjoinEnabled, state.setPayjoinEnabled])
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
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
