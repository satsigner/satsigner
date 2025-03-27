import DatePicker from '@dietime/react-native-date-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCurrencyInput from '@/components/SSCurrencyInput'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors, Sizes } from '@/styles'
import { transparent } from '@/styles/colors'
import { formatNumber } from '@/utils/format'

const SATS_PER_BITCOIN = 100_000_000

export default function Converter() {
  const [sats, setSats] = useState(0)
  const [bitcoin, setBitcoin] = useState(0)
  const [date, setDate] = useState(new Date())
  const [pickerKey, setPickerKey] = useState(0)

  const handleSatsChange = useCallback((sats: number) => {
    setSats(sats)
    setBitcoin(sats / SATS_PER_BITCOIN)
  }, [])

  const handleBitcoinChange = useCallback((bitcoin: number) => {
    setBitcoin(bitcoin)
    setSats(Math.round(bitcoin * SATS_PER_BITCOIN))
  }, [])

  const [prices, fetchFullPriceAt] = usePriceStore(
    useShallow((state) => [state.prices, state.fetchFullPriceAt])
  )

  useFocusEffect(
    useCallback(() => {
      const timestamp = Math.floor(date.setHours(0, 0, 0, 0) / 1000)
      fetchFullPriceAt(timestamp)
    }, [fetchFullPriceAt, date])
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
      <SSVStack gap="none" justifyBetween>
        <SSVStack>
          <SSVStack itemsCenter style={styles.inputContainer}>
            <SSCurrencyInput
              value={sats.toString()}
              size="large"
              onChangeValue={handleSatsChange}
              align="center"
              style={styles.currencyInput}
            />
            <SSText size="xs" color="muted">
              {t('converter.currency.sats')}
            </SSText>
          </SSVStack>
          <SSVStack itemsCenter style={styles.inputContainer}>
            <SSCurrencyInput
              value={bitcoin.toString()}
              size="large"
              onChangeValue={handleBitcoinChange}
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
                <SSText size="md">
                  {formatNumber((prices.USD || 0) * bitcoin, 2, false, ',')}
                </SSText>
                <SSText size="xs" color="muted">
                  🇺🇸 {t('converter.currency.usd')}
                </SSText>
              </SSVStack>
              <SSVStack
                itemsCenter
                gap="none"
                style={styles.currencyBlockNoBorder}
              >
                <SSText size="md">
                  {formatNumber((prices.EUR || 0) * bitcoin, 2, false, ',')}
                </SSText>
                <SSText size="xs" color="muted">
                  🇪🇺 {t('converter.currency.eur')}
                </SSText>
              </SSVStack>
            </SSHStack>
            <SSHStack gap="none" style={styles.rowSeparator}>
              <SSVStack itemsCenter gap="none" style={styles.currencyBlock}>
                <SSText size="md">
                  {formatNumber((prices.GBP || 0) * bitcoin, 2, false, ',')}
                </SSText>
                <SSText size="xs" color="muted">
                  🇬🇧 {t('converter.currency.gbp')}
                </SSText>
              </SSVStack>
              <SSVStack
                itemsCenter
                gap="none"
                style={styles.currencyBlockNoBorder}
              >
                <SSText size="md">
                  {formatNumber((prices.CAD || 0) * bitcoin, 2, false, ',')}
                </SSText>
                <SSText size="xs" color="muted">
                  🇨🇦 {t('converter.currency.cad')}
                </SSText>
              </SSVStack>
            </SSHStack>
            <SSHStack gap="none" style={styles.rowSeparator}>
              <SSVStack itemsCenter gap="none" style={styles.currencyBlock}>
                <SSText size="md">
                  {formatNumber((prices.CHF || 0) * bitcoin, 2, false, ',')}
                </SSText>
                <SSText size="xs" color="muted">
                  🇨🇭 {t('converter.currency.chf')}
                </SSText>
              </SSVStack>
              <SSVStack
                itemsCenter
                gap="none"
                style={styles.currencyBlockNoBorder}
              >
                <SSText size="md">
                  {formatNumber((prices.JPY || 0) * bitcoin, 2, false, ',')}
                </SSText>
                <SSText size="xs" color="muted">
                  🇯🇵 {t('converter.currency.jpy')}
                </SSText>
              </SSVStack>
            </SSHStack>
          </SSVStack>
        </SSVStack>
        <SSVStack style={styles.dateContainer} gap="lg">
          <View>
            <DatePicker
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
            <LinearGradient
              style={[styles.gradient, { bottom: 0, height: 60 }]}
              colors={['#000000BB', Colors.black]}
              pointerEvents="none"
            />
            <LinearGradient
              style={[styles.gradient, { top: 0, height: 60 }]}
              colors={[Colors.black, '#000000BB']}
              pointerEvents="none"
            />
          </View>
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
