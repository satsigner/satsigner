import { Stack, useRouter } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import { useFiatData } from '@/hooks/useFiatData'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn } from '@/locales'
import { usePriceStore } from '@/store/price'
import { type Currency } from '@/types/models/Blockchain'

const tl = tn('settings.fiat')

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
  const router = useRouter()
  const { showCurrentFiat } = useFiatData()
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
        {showCurrentFiat ? (
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
        ) : (
          <SSVStack gap="md">
            <SSText color="muted">{tl('disabled')}</SSText>
            <SSButton
              label={tl('openFiatDataSettings')}
              variant="outline"
              onPress={() => router.navigate('/settings/features/fiatData')}
            />
          </SSVStack>
        )}
      </SSMainLayout>
    </>
  )
}
