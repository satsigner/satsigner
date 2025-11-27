import { Stack } from 'expo-router'
import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn } from '@/locales'
import { useSettingsStore } from '@/store/settings'

const tl = tn('settings.features.currencyFormatting')

export default function CurrencyFormatting() {
  const [currencyUnit, useZeroPadding, setCurrencyUnit, setUseZeroPadding] =
    useSettingsStore(
      useShallow((state) => [
        state.currencyUnit,
        state.useZeroPadding,
        state.setCurrencyUnit,
        state.setUseZeroPadding
      ])
    )

  const togglePadding = useCallback(
    () => setUseZeroPadding(!useZeroPadding),
    [setUseZeroPadding, useZeroPadding]
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tl('title')}</SSText>,
          headerRight: undefined
        }}
      />
      <SSMainLayout>
        <SSVStack>
          <SSVStack>
            <SSText>{tl('displayOptions')}</SSText>
            <SSCheckbox
              label={tl('showZeroPadding')}
              selected={useZeroPadding}
              onPress={togglePadding}
            />
          </SSVStack>
          <SSVStack>
            <SSText>{tl('currencyUnit')}</SSText>
            <SSVStack>
              <SSCheckbox
                label="SATS"
                selected={currencyUnit === 'sats'}
                onPress={() => setCurrencyUnit('sats')}
              />
              <SSCheckbox
                label="BTC"
                selected={currencyUnit === 'btc'}
                onPress={() => setCurrencyUnit('btc')}
              />
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
