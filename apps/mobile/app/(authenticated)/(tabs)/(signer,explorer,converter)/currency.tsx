import { Stack, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCurrencyInput from '@/components/SSCurrencyInput'
import SSDatePicker from '@/components/SSDatePicker'
import SSText from '@/components/SSText'
import { SATS_PER_BITCOIN } from '@/constants/btc'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors, Sizes } from '@/styles'
import { transparent } from '@/styles/colors'

export default function Converter() {
  const hasInitializedRef = useRef(false)

  const [date, setDate] = useState(new Date())
  const [pickerKey, setPickerKey] = useState(0)
  const [lastChangeKey, setLastChangedKey] = useState<
    'sats' | 'bitcoin' | 'USD' | 'EUR' | 'GBP' | 'CAD' | 'CHF' | 'JPY'
  >('sats')
  const [currencyValues, setCurrencyValues] = useState({
    sats: 0,
    bitcoin: 0,
    USD: 0,
    EUR: 0,
    GBP: 0,
    CAD: 0,
    CHF: 0,
    JPY: 0
  })

  const [prices, fetchFullPriceAt] = usePriceStore(
    useShallow((state) => [state.prices, state.fetchFullPriceAt])
  )

  const handleValueChange = useCallback(
    (key: keyof typeof currencyValues, value: number) => {
      setLastChangedKey(key)

      let bitcoinValue = 0

      if (key === 'sats') {
        bitcoinValue = value / SATS_PER_BITCOIN
      } else if (key === 'bitcoin') {
        bitcoinValue = value
      } else {
        const price = prices[key]
        bitcoinValue = price ? value / price : 0
      }

      const updatedValues = {
        sats: Math.round(bitcoinValue * SATS_PER_BITCOIN),
        bitcoin: bitcoinValue,
        USD: (prices.USD || 0) * bitcoinValue,
        EUR: (prices.EUR || 0) * bitcoinValue,
        GBP: (prices.GBP || 0) * bitcoinValue,
        CAD: (prices.CAD || 0) * bitcoinValue,
        CHF: (prices.CHF || 0) * bitcoinValue,
        JPY: (prices.JPY || 0) * bitcoinValue,
        [key]: value
      }

      setCurrencyValues(updatedValues)
    },
    [prices]
  )

  useFocusEffect(
    useCallback(() => {
      const timestamp = Math.floor(date.setHours(0, 0, 0, 0) / 1000)
      fetchFullPriceAt(timestamp)
    }, [fetchFullPriceAt, date])
  )

  useFocusEffect(
    useCallback(() => {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true
        handleValueChange('bitcoin', 1)
      } else {
        handleValueChange(lastChangeKey, currencyValues[lastChangeKey])
      }
    }, [prices]) // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={styles.headerTitle}>
              {t('converter.title')}
            </SSText>
          ),
          headerBackVisible: false
        }}
      />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <SSVStack gap="none" justifyBetween>
          <SSVStack>
            <SSVStack itemsCenter style={styles.inputContainer}>
              <SSCurrencyInput
                value={currencyValues.sats.toString()}
                size="large"
                onChangeValue={(value) => handleValueChange('sats', value)}
                align="center"
                style={styles.currencyInput}
              />
              <SSText size="xs" color="muted">
                {t('converter.currency.sats')}
              </SSText>
            </SSVStack>
            <SSVStack itemsCenter style={styles.inputContainer}>
              <SSCurrencyInput
                value={currencyValues.bitcoin.toString()}
                size="large"
                onChangeValue={(value) => handleValueChange('bitcoin', value)}
                align="center"
                style={styles.currencyInput}
              />
              <SSText size="xs" color="muted">
                {t('converter.currency.bitcoin')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none" style={styles.currencySection}>
              <SSHStack gap="none" style={styles.rowSeparator}>
                <SSVStack itemsCenter gap="none" style={styles.currencyBlock}>
                  <SSCurrencyInput
                    decimal={2}
                    value={currencyValues.USD.toString()}
                    size="small"
                    onChangeValue={(value) => handleValueChange('USD', value)}
                    align="center"
                    style={styles.currencyInput}
                  />
                  <SSText size="xs" color="muted">
                    🇺🇸 {t('converter.currency.usd')}
                  </SSText>
                </SSVStack>
                <SSVStack
                  itemsCenter
                  gap="none"
                  style={styles.currencyBlockNoBorder}
                >
                  <SSCurrencyInput
                    decimal={2}
                    value={currencyValues.EUR.toString()}
                    size="small"
                    onChangeValue={(value) => handleValueChange('EUR', value)}
                    align="center"
                    style={styles.currencyInput}
                  />
                  <SSText size="xs" color="muted">
                    🇪🇺 {t('converter.currency.eur')}
                  </SSText>
                </SSVStack>
              </SSHStack>
              <SSHStack gap="none" style={styles.rowSeparator}>
                <SSVStack itemsCenter gap="none" style={styles.currencyBlock}>
                  <SSCurrencyInput
                    decimal={2}
                    value={currencyValues.GBP.toString()}
                    size="small"
                    onChangeValue={(value) => handleValueChange('GBP', value)}
                    align="center"
                    style={styles.currencyInput}
                  />
                  <SSText size="xs" color="muted">
                    🇬🇧 {t('converter.currency.gbp')}
                  </SSText>
                </SSVStack>
                <SSVStack
                  itemsCenter
                  gap="none"
                  style={styles.currencyBlockNoBorder}
                >
                  <SSCurrencyInput
                    decimal={2}
                    value={currencyValues.CAD.toString()}
                    size="small"
                    onChangeValue={(value) => handleValueChange('CAD', value)}
                    align="center"
                    style={styles.currencyInput}
                  />
                  <SSText size="xs" color="muted">
                    🇨🇦 {t('converter.currency.cad')}
                  </SSText>
                </SSVStack>
              </SSHStack>
              <SSHStack gap="none" style={styles.rowSeparator}>
                <SSVStack itemsCenter gap="none" style={styles.currencyBlock}>
                  <SSCurrencyInput
                    decimal={2}
                    value={currencyValues.CHF.toString()}
                    size="small"
                    onChangeValue={(value) => handleValueChange('CHF', value)}
                    align="center"
                    style={styles.currencyInput}
                  />
                  <SSText size="xs" color="muted">
                    🇨🇭 {t('converter.currency.chf')}
                  </SSText>
                </SSVStack>
                <SSVStack
                  itemsCenter
                  gap="none"
                  style={styles.currencyBlockNoBorder}
                >
                  <SSCurrencyInput
                    decimal={2}
                    value={currencyValues.JPY.toString()}
                    size="small"
                    onChangeValue={(value) => handleValueChange('JPY', value)}
                    align="center"
                    style={styles.currencyInput}
                  />
                  <SSText size="xs" color="muted">
                    🇯🇵 {t('converter.currency.jpy')}
                  </SSText>
                </SSVStack>
              </SSHStack>
            </SSVStack>
          </SSVStack>
          <SSVStack style={styles.dateContainer} gap="lg">
            <SSDatePicker
              key={pickerKey}
              value={date}
              onChange={(value) => setDate(value)}
              width="80%"
              height={200}
              fontSize={Sizes.text.fontSize['2xl']}
              textColor={Colors.white}
              fadeColor={Colors.black}
              markColor={Colors.gray[950]}
              markHeight={46}
              startYear={2011}
            />
            <SSButton
              key="today"
              label={t('date.today')}
              variant="outline"
              onPress={() => {
                setDate(new Date())
                setPickerKey((prev) => prev + 1)
              }}
              disabled={date.toDateString() === new Date().toDateString()}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  headerTitle: {
    letterSpacing: 1
  },
  inputContainer: {
    borderTopWidth: 1,
    borderColor: Colors.gray[875],
    paddingTop: 20,
    paddingBottom: 6,
    gap: -2
  },
  currencyInput: {
    backgroundColor: transparent
  },
  currencySection: {
    borderTopWidth: 1,
    borderColor: Colors.gray[875]
  },
  rowSeparator: {
    borderBottomWidth: 1,
    borderColor: Colors.gray[875]
  },
  currencyBlock: {
    flex: 1,
    padding: 12,
    borderRightWidth: 1,
    borderColor: Colors.gray[875]
  },
  currencyBlockNoBorder: {
    flex: 1,
    padding: 12
  },
  dateContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'black'
  },
  gradient: {
    position: 'absolute',
    width: '100%'
  }
})
