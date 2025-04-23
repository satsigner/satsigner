import { Stack } from 'expo-router'
import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'

export default function CurrencyFormatting() {
  const [setUseZeroPadding, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.setUseZeroPadding, state.useZeroPadding])
  )

  const togglePadding = useCallback(
    () => setUseZeroPadding(!useZeroPadding),
    [setUseZeroPadding, useZeroPadding]
  )
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {t('settings.features.currencyFormatting.title')}
            </SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSMainLayout>
        <SSVStack>
          <SSCheckbox
            label={t('settings.features.currencyFormatting.showZeroPadding')}
            selected={useZeroPadding}
            onPress={togglePadding}
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
