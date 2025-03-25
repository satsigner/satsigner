import { Stack, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSCurrencyInput from '@/components/SSCurrencyInput'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { transparent } from '@/styles/colors'
import { formatNumber } from '@/utils/format'

const SATS_PER_BITCOIN = 100_000_000

export default function Converter() {
  const [sats, setSats] = useState(0)
  const [bitcoin, setBitcoin] = useState(0)

  const handleSatsChange = useCallback((sats: number) => {
    setSats(sats)
    setBitcoin(sats / SATS_PER_BITCOIN)
  }, [])

  const handleBitcoinChange = useCallback((bitcoin: number) => {
    setBitcoin(bitcoin)
    setSats(Math.round(bitcoin * SATS_PER_BITCOIN))
  }, [])

  const [prices, fetchPrices] = usePriceStore(
    useShallow((state) => [state.prices, state.fetchPrices])
  )

  useFocusEffect(
    useCallback(() => {
      fetchPrices()
    }, [fetchPrices])
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
                {t('converter.currency.usd')}
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
                {t('converter.currency.eur')}
              </SSText>
            </SSVStack>
          </SSHStack>
          <SSHStack gap="none" style={styles.rowSeparator}>
            <SSVStack itemsCenter gap="none" style={styles.currencyBlock}>
              <SSText size="md">
                {formatNumber((prices.GBP || 0) * bitcoin, 2, false, ',')}
              </SSText>
              <SSText size="xs" color="muted">
                {t('converter.currency.gbp')}
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
                {t('converter.currency.cad')}
              </SSText>
            </SSVStack>
          </SSHStack>
          <SSHStack gap="none" style={styles.rowSeparator}>
            <SSVStack itemsCenter gap="none" style={styles.currencyBlock}>
              <SSText size="md">
                {formatNumber((prices.CHF || 0) * bitcoin, 2, false, ',')}
              </SSText>
              <SSText size="xs" color="muted">
                {t('converter.currency.chf')}
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
                {t('converter.currency.jpy')}
              </SSText>
            </SSVStack>
          </SSHStack>
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
  }
})
