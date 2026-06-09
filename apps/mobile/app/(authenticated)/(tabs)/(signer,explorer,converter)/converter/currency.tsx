import { Stack, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCurrencyInput from '@/components/SSCurrencyInput'
import SSDatePicker from '@/components/SSDatePicker'
import SSText from '@/components/SSText'
import { SATS_PER_BITCOIN } from '@/constants/btc'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { Colors, Layout, Sizes } from '@/styles'
import { transparent } from '@/styles/colors'
import { formatLargeNumber } from '@/utils/formatLargeNumber'

const MUTED_OPACITY = 0.35
const MUTE_DURATION = 150
const MUTE_STAGGER = 40
const UNMUTE_DURATION = 200
const UNMUTE_STAGGER = 60
const DATE_PICKER_START_YEAR = 2011
const DATE_PICKER_HEIGHT = 160
const DATE_PICKER_MARK_HEIGHT = 46
const WRITTEN_NUMBER_HEIGHT = 20
const WRITTEN_NUMBER_DURATION = 180

function ConverterHeader() {
  return (
    <SSText uppercase style={styles.headerTitle}>
      {t('converter.title')}
    </SSText>
  )
}

export default function Converter() {
  const hasInitializedRef = useRef(false)

  const [date, setDate] = useState(new Date())
  const dateRef = useRef(date)
  const [pickerKey, setPickerKey] = useState(0)
  const [lastChangeKey, setLastChangedKey] = useState<
    'sats' | 'bitcoin' | 'USD' | 'EUR' | 'GBP' | 'CAD' | 'CHF' | 'JPY'
  >('sats')
  const [isLoading, setIsLoading] = useState(false)
  const [showWrittenNumbers, setShowWrittenNumbers] = useState(false)
  const [useEuropeanScale, setUseEuropeanScale] = useState(false)
  const [currencyValues, setCurrencyValues] = useState({
    CAD: 0,
    CHF: 0,
    EUR: 0,
    GBP: 0,
    JPY: 0,
    USD: 0,
    bitcoin: 0,
    sats: 0
  })

  const [prices, fetchFullPriceAt] = usePriceStore(
    useShallow((state) => [state.prices, state.fetchFullPriceAt])
  )
  const prevPricesRef = useRef(prices)

  const writtenNumberH = useSharedValue(0)
  const writtenNumberAnimStyle = useAnimatedStyle(() => ({
    height: writtenNumberH.value,
    overflow: 'hidden'
  }))

  const prevShowWrittenRef = useRef(showWrittenNumbers)
  if (prevShowWrittenRef.current !== showWrittenNumbers) {
    prevShowWrittenRef.current = showWrittenNumbers
    writtenNumberH.value = withTiming(
      showWrittenNumbers ? WRITTEN_NUMBER_HEIGHT : 0,
      { duration: WRITTEN_NUMBER_DURATION }
    )
  }

  const op0 = useSharedValue(1)
  const op1 = useSharedValue(1)
  const op2 = useSharedValue(1)
  const op3 = useSharedValue(1)
  const op4 = useSharedValue(1)

  const animStyle0 = useAnimatedStyle(() => ({ opacity: op0.value }))
  const animStyle1 = useAnimatedStyle(() => ({ opacity: op1.value }))
  const animStyle2 = useAnimatedStyle(() => ({ opacity: op2.value }))
  const animStyle3 = useAnimatedStyle(() => ({ opacity: op3.value }))
  const animStyle4 = useAnimatedStyle(() => ({ opacity: op4.value }))

  const prevIsLoadingRef = useRef(isLoading)
  if (prevIsLoadingRef.current !== isLoading) {
    prevIsLoadingRef.current = isLoading
    if (isLoading) {
      op0.value = withTiming(MUTED_OPACITY, { duration: MUTE_DURATION })
      op1.value = withDelay(MUTE_STAGGER * 1, withTiming(MUTED_OPACITY, { duration: MUTE_DURATION }))
      op2.value = withDelay(MUTE_STAGGER * 2, withTiming(MUTED_OPACITY, { duration: MUTE_DURATION }))
      op3.value = withDelay(MUTE_STAGGER * 3, withTiming(MUTED_OPACITY, { duration: MUTE_DURATION }))
      op4.value = withDelay(MUTE_STAGGER * 4, withTiming(MUTED_OPACITY, { duration: MUTE_DURATION }))
    } else {
      op0.value = withTiming(1, { duration: UNMUTE_DURATION })
      op1.value = withDelay(UNMUTE_STAGGER * 1, withTiming(1, { duration: UNMUTE_DURATION }))
      op2.value = withDelay(UNMUTE_STAGGER * 2, withTiming(1, { duration: UNMUTE_DURATION }))
      op3.value = withDelay(UNMUTE_STAGGER * 3, withTiming(1, { duration: UNMUTE_DURATION }))
      op4.value = withDelay(UNMUTE_STAGGER * 4, withTiming(1, { duration: UNMUTE_DURATION }))
    }
  }

  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool['bitcoin']
  )

  if (prices !== prevPricesRef.current && hasInitializedRef.current) {
    prevPricesRef.current = prices
    const anchoredValue = currencyValues[lastChangeKey]
    const btc = getBitcoinValue(lastChangeKey, anchoredValue)
    setIsLoading(false)
    setCurrencyValues({
      CAD: (prices.CAD || 0) * btc,
      CHF: (prices.CHF || 0) * btc,
      EUR: (prices.EUR || 0) * btc,
      GBP: (prices.GBP || 0) * btc,
      JPY: (prices.JPY || 0) * btc,
      USD: (prices.USD || 0) * btc,
      bitcoin: btc,
      sats: Math.round(btc * SATS_PER_BITCOIN),
      [lastChangeKey]: anchoredValue
    })
  }

  function getBitcoinValue(key: keyof typeof currencyValues, value: number): number {
    if (key === 'sats') return value / SATS_PER_BITCOIN
    if (key === 'bitcoin') return value
    const price = prices[key]
    return price ? value / price : 0
  }

  function handleValueChange(key: keyof typeof currencyValues, value: number) {
    setLastChangedKey(key)

    const bitcoinValue = getBitcoinValue(key, value)

    const updatedValues = {
      CAD: (prices.CAD || 0) * bitcoinValue,
      CHF: (prices.CHF || 0) * bitcoinValue,
      EUR: (prices.EUR || 0) * bitcoinValue,
      GBP: (prices.GBP || 0) * bitcoinValue,
      JPY: (prices.JPY || 0) * bitcoinValue,
      USD: (prices.USD || 0) * bitcoinValue,
      bitcoin: bitcoinValue,
      sats: Math.round(bitcoinValue * SATS_PER_BITCOIN),
      [key]: value
    }

    setCurrencyValues(updatedValues)
  }

  function handleSatsChange(value: number) { handleValueChange('sats', value) }
  function handleBitcoinChange(value: number) { handleValueChange('bitcoin', value) }
  function handleUsdChange(value: number) { handleValueChange('USD', value) }
  function handleEurChange(value: number) { handleValueChange('EUR', value) }
  function handleGbpChange(value: number) { handleValueChange('GBP', value) }
  function handleCadChange(value: number) { handleValueChange('CAD', value) }
  function handleChfChange(value: number) { handleValueChange('CHF', value) }
  function handleJpyChange(value: number) { handleValueChange('JPY', value) }

  function handleDragStart() {
    setIsLoading(true)
  }

  function handleToggleWrittenNumbers() {
    setShowWrittenNumbers((prev) => !prev)
  }

  function handleToggleEuropeanScale() {
    setUseEuropeanScale((prev) => !prev)
  }

  function handleTodayPress() {
    handleDateChange(new Date())
    setPickerKey((prev) => prev + 1)
  }

  function handleDateChange(value: Date) {
    dateRef.current = value
    setDate(value)
    const timestamp = Math.floor(new Date(value).setHours(0, 0, 0, 0) / 1000)
    setIsLoading(true)
    fetchFullPriceAt(mempoolUrl, timestamp)
  }

  useFocusEffect(
    useCallback(() => {
      const timestamp = Math.floor(new Date(dateRef.current).setHours(0, 0, 0, 0) / 1000)
      setIsLoading(true)
      fetchFullPriceAt(mempoolUrl, timestamp)
    }, [fetchFullPriceAt, mempoolUrl]) // eslint-disable-line react-hooks/exhaustive-deps
  )

  useFocusEffect(
    useCallback(() => {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true
        handleValueChange('bitcoin', 1)
      }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <>
      <Stack.Screen
        options={{ headerTitle: ConverterHeader }}
      />
      <SSMainLayout style={styles.mainLayout}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack gap="none" justifyBetween>
            <SSVStack gap="none">
              <Animated.View style={animStyle0}>
                <SSVStack itemsCenter widthFull gap="none" style={styles.inputContainer}>
                  <SSCurrencyInput
                    value={currencyValues.sats.toString()}
                    size="large"
                    onChangeValue={handleSatsChange}
                    align="center"
                    style={styles.currencyInputLarge}
                  />
                  <Animated.View style={writtenNumberAnimStyle}>
                    <SSText size="xs" color="muted" style={styles.writtenNumber}>
                      {formatLargeNumber(currencyValues.sats, useEuropeanScale)}
                    </SSText>
                  </Animated.View>
                  <SSText size="xs" color="muted" uppercase style={styles.currencyLabelLarge}>
                    ⚪️ {t('converter.currency.sats')}
                  </SSText>
                </SSVStack>
              </Animated.View>
              <Animated.View style={animStyle1}>
                <SSVStack itemsCenter widthFull gap="none" style={styles.inputContainer}>
                  <SSCurrencyInput
                    value={currencyValues.bitcoin.toFixed(8).replace(/\.?0+$/, '')}
                    size="large"
                    onChangeValue={handleBitcoinChange}
                    align="center"
                    style={styles.currencyInputLarge}
                  />
                  <Animated.View style={writtenNumberAnimStyle}>
                    <SSText size="xs" color="muted" style={styles.writtenNumber}>
                      {formatLargeNumber(currencyValues.bitcoin, useEuropeanScale)}
                    </SSText>
                  </Animated.View>
                  <SSText size="xs" color="muted" uppercase style={styles.currencyLabelLarge}>
                    🌍 {t('converter.currency.bitcoin')}
                  </SSText>
                </SSVStack>
              </Animated.View>
              <SSVStack gap="none" style={styles.currencySection}>
                <Animated.View style={animStyle2}>
                  <SSHStack gap="none" style={styles.rowSeparator}>
                    <SSVStack itemsCenter gap="none" style={styles.currencyBlock}>
                      <SSCurrencyInput
                        decimal={2}
                        value={currencyValues.USD.toString()}
                        size="small"
                        onChangeValue={handleUsdChange}
                        align="center"
                        style={styles.currencyInput}
                      />
                      <Animated.View style={writtenNumberAnimStyle}>
                        <SSText size="xs" color="muted" style={styles.writtenNumber}>
                          {formatLargeNumber(currencyValues.USD, useEuropeanScale)}
                        </SSText>
                      </Animated.View>
                      <SSText size="xs" color="muted" style={styles.currencyLabel}>
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
                        onChangeValue={handleEurChange}
                        align="center"
                        style={styles.currencyInput}
                      />
                      <Animated.View style={writtenNumberAnimStyle}>
                        <SSText size="xs" color="muted" style={styles.writtenNumber}>
                          {formatLargeNumber(currencyValues.EUR, useEuropeanScale)}
                        </SSText>
                      </Animated.View>
                      <SSText size="xs" color="muted" style={styles.currencyLabel}>
                        🇪🇺 {t('converter.currency.eur')}
                      </SSText>
                    </SSVStack>
                  </SSHStack>
                </Animated.View>
                <Animated.View style={animStyle3}>
                  <SSHStack gap="none" style={styles.rowSeparator}>
                    <SSVStack itemsCenter gap="none" style={styles.currencyBlock}>
                      <SSCurrencyInput
                        decimal={2}
                        value={currencyValues.GBP.toString()}
                        size="small"
                        onChangeValue={handleGbpChange}
                        align="center"
                        style={styles.currencyInput}
                      />
                      <Animated.View style={writtenNumberAnimStyle}>
                        <SSText size="xs" color="muted" style={styles.writtenNumber}>
                          {formatLargeNumber(currencyValues.GBP, useEuropeanScale)}
                        </SSText>
                      </Animated.View>
                      <SSText size="xs" color="muted" style={styles.currencyLabel}>
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
                        onChangeValue={handleCadChange}
                        align="center"
                        style={styles.currencyInput}
                      />
                      <Animated.View style={writtenNumberAnimStyle}>
                        <SSText size="xs" color="muted" style={styles.writtenNumber}>
                          {formatLargeNumber(currencyValues.CAD, useEuropeanScale)}
                        </SSText>
                      </Animated.View>
                      <SSText size="xs" color="muted" style={styles.currencyLabel}>
                        🇨🇦 {t('converter.currency.cad')}
                      </SSText>
                    </SSVStack>
                  </SSHStack>
                </Animated.View>
                <Animated.View style={animStyle4}>
                <SSHStack gap="none" style={styles.rowSeparator}>
                  <SSVStack itemsCenter gap="none" style={styles.currencyBlock}>
                    <SSCurrencyInput
                      decimal={2}
                      value={currencyValues.CHF.toString()}
                      size="small"
                      onChangeValue={handleChfChange}
                      align="center"
                      style={styles.currencyInput}
                    />
                    <Animated.View style={writtenNumberAnimStyle}>
                      <SSText size="xs" color="muted" style={styles.writtenNumber}>
                        {formatLargeNumber(currencyValues.CHF, useEuropeanScale)}
                      </SSText>
                    </Animated.View>
                    <SSText size="xs" color="muted" style={styles.currencyLabel}>
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
                      onChangeValue={handleJpyChange}
                      align="center"
                      style={styles.currencyInput}
                    />
                    <Animated.View style={writtenNumberAnimStyle}>
                      <SSText size="xs" color="muted" style={styles.writtenNumber}>
                        {formatLargeNumber(currencyValues.JPY, useEuropeanScale)}
                      </SSText>
                    </Animated.View>
                    <SSText size="xs" color="muted" style={styles.currencyLabel}>
                      🇯🇵 {t('converter.currency.jpy')}
                    </SSText>
                  </SSVStack>
                </SSHStack>
                </Animated.View>
              </SSVStack>
            </SSVStack>
            <SSVStack style={styles.dateContainer} gap="sm">
              <SSDatePicker
                key={pickerKey}
                value={date}
                onChange={handleDateChange}
                onDragStart={handleDragStart}
                width="80%"
                height={DATE_PICKER_HEIGHT}
                fontSize={Sizes.text.fontSize['2xl']}
                textColor={Colors.white}
                fadeColor={Colors.gray[950]}
                markColor={Colors.gray[950]}
                markHeight={DATE_PICKER_MARK_HEIGHT}
                startYear={DATE_PICKER_START_YEAR}
              />
              <SSVStack gap="sm" style={styles.toggleRow}>
                <SSButton
                  key="today"
                  label={t('date.today')}
                  variant="outline"
                  onPress={handleTodayPress}
                  disabled={date.toDateString() === new Date().toDateString()}
                />
                <SSHStack gap="sm">
                  <SSButton
                    label={t('converter.writtenNumbers')}
                    variant="outline"
                    onPress={handleToggleWrittenNumbers}
                    style={showWrittenNumbers ? [styles.toggleButton, styles.toggleButtonActive] : styles.toggleButton}
                  />
                  <SSButton
                    label={t('converter.europeanScale')}
                    variant="outline"
                    onPress={handleToggleEuropeanScale}
                    disabled={!showWrittenNumbers}
                    style={useEuropeanScale ? [styles.toggleButton, styles.toggleButtonActive] : styles.toggleButton}
                  />
                </SSHStack>
              </SSVStack>
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  currencyBlock: {
    borderColor: Colors.gray[875],
    borderRightWidth: 1,
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  currencyBlockNoBorder: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  currencyInput: {
    backgroundColor: transparent,
    height: 32,
    letterSpacing: 0.5,
    paddingBottom: 0,
    paddingTop: 8
  },
  currencyInputLarge: {
    backgroundColor: transparent,
    height: 44,
    letterSpacing: 1,
    paddingBottom: 0,
    paddingTop: 10
  },
  currencyLabel: {
    paddingBottom: 6,
    textAlign: 'center',
    width: '100%'
  },
  currencyLabelLarge: {
    paddingBottom: 14,
    paddingTop: 2,
    textAlign: 'center',
    width: '100%'
  },
  currencySection: {
    borderColor: Colors.gray[875],
    borderTopWidth: 1
  },
  dateContainer: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: Layout.mainContainer.paddingBottom
  },
  headerTitle: {
    letterSpacing: 1
  },
  mainLayout: {
    paddingHorizontal: 0,
    paddingTop: 0
  },
  scrollContent: {
    flexGrow: 1
  },
  inputContainer: {
    borderColor: Colors.gray[875],
    borderTopWidth: 1,
    paddingBottom: 4,
    paddingTop: 8
  },
  rowSeparator: {
    borderBottomWidth: 1,
    borderColor: Colors.gray[875]
  },
  toggleButton: {
    flex: 1
  },
  toggleButtonActive: {
    backgroundColor: Colors.gray[700]
  },
  toggleRow: {
    width: '100%'
  },
  writtenNumber: {
    paddingBottom: 2,
    textAlign: 'center',
    width: '100%'
  }
})
