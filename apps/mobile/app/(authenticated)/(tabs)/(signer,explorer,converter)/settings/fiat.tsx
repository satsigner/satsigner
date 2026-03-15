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
  { value: 'USD', label: 'USD – US Dollar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'GBP', label: 'GBP – British Pound' },
  { value: 'CAD', label: 'CAD – Canadian Dollar' },
  { value: 'CHF', label: 'CHF – Swiss Franc' },
  { value: 'AUD', label: 'AUD – Australian Dollar' },
  { value: 'JPY', label: 'JPY – Japanese Yen' }
]

export default function FiatCurrency() {
  const [fiatCurrency, setFiatCurrency] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.setFiatCurrency])
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.fiat.title')}</SSText>
          ),
          headerRight: undefined
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
