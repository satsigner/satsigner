import { Stack } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { type Currency } from '@/types/models/Blockchain'

const CURRENCIES: { value: Currency; label: string }[] = [
  { label: 'USD – US Dollar', value: 'USD' },
  { label: 'EUR – Euro', value: 'EUR' },
  { label: 'GBP – British Pound', value: 'GBP' },
  { label: 'CAD – Canadian Dollar', value: 'CAD' },
  { label: 'CHF – Swiss Franc', value: 'CHF' },
  { label: 'AUD – Australian Dollar', value: 'AUD' },
  { label: 'JPY – Japanese Yen', value: 'JPY' }
]

export default function FiatCurrency() {
  const [fiatCurrency, setFiatCurrency] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.setFiatCurrency])
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.fiat.title')}</SSText>
          )
        }}
      />
      <SSMainLayout>
        <SSVStack>
          <SSText>{t('settings.fiat.select')}</SSText>
          <SSVStack>
            {CURRENCIES.map(({ value, label }) => (
              <SSCheckbox
                key={value}
                label={label}
                selected={fiatCurrency === value}
                onPress={() => setFiatCurrency(value)}
              />
            ))}
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
