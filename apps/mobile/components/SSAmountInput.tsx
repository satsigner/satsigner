import { Slider } from '@miblanchard/react-native-slider'
import { useState } from 'react'
import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { formatNumber } from '@/utils/format'

import SSNumberGhostInput from './SSNumberGhostInput'
import SSText from './SSText'

type SSAmountInputProps = {
  min: number
  max: number
  value: number
  remainingSats: number
  fiatCurrency: string
  btcPrice: number
  satsToFiat: (sats: number) => number
  onValueChange: (value: number) => void
}

function SSAmountInput({
  min,
  max,
  value,
  remainingSats,
  fiatCurrency,
  btcPrice,
  satsToFiat,
  onValueChange
}: SSAmountInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const [amountMode, setAmountMode] = useState<'sats' | 'fiat'>('sats')
  const [localFiatValue, setLocalFiatValue] = useState(() => satsToFiat(value))

  function handleSatsChange(text: string) {
    const sats = Number(text)
    setLocalValue(sats)
    setLocalFiatValue(satsToFiat(sats))
    onValueChange(sats)
  }

  function handleFiatChange(text: string) {
    const fiat = Number(text)
    if (isNaN(fiat) || !btcPrice || btcPrice <= 0) return
    const sats = Math.max(
      min,
      Math.min(max, Math.round((fiat / btcPrice) * 1e8))
    )
    setLocalFiatValue(fiat)
    setLocalValue(sats)
    onValueChange(sats)
  }

  function handleSwitchToFiat() {
    setLocalFiatValue(satsToFiat(localValue))
    setAmountMode('fiat')
  }

  function handleSwitchToSats() {
    setAmountMode('sats')
  }

  const remainingValue = remainingSats - localValue
  const fiatMin = btcPrice > 0 ? satsToFiat(min) : 0
  const fiatMax = btcPrice > 0 ? satsToFiat(max) : 0
  const canSwitchMode = btcPrice > 0

  return (
    <SSVStack gap="none">
      {amountMode === 'sats' ? (
        <SSNumberGhostInput
          min={min}
          max={max}
          suffix={t('bitcoin.sats')}
          allowDecimal={false}
          value={String(localValue)}
          onChangeText={handleSatsChange}
        />
      ) : (
        <SSNumberGhostInput
          min={fiatMin}
          max={fiatMax}
          suffix={fiatCurrency}
          allowDecimal
          value={String(localFiatValue.toFixed(2))}
          onChangeText={handleFiatChange}
        />
      )}
      <SSHStack gap="xs" style={{ justifyContent: 'center' }}>
        {amountMode === 'sats' ? (
          <SSText
            color="muted"
            size="lg"
            onPress={canSwitchMode ? handleSwitchToFiat : undefined}
            style={canSwitchMode ? styles.switchable : undefined}
          >
            {formatNumber(satsToFiat(localValue), 2)} {fiatCurrency}
          </SSText>
        ) : (
          <SSText
            color="muted"
            size="lg"
            onPress={handleSwitchToSats}
            style={styles.switchable}
          >
            {formatNumber(localValue, 0)} {t('bitcoin.sats')}
          </SSText>
        )}
      </SSHStack>
      <SSHStack justifyBetween>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>{min}</SSText>
          <SSText color="muted">{t('bitcoin.sats')}</SSText>
        </SSHStack>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText color="muted">
            {t('common.remaining')} {formatNumber(remainingValue, 0)}{' '}
            {t('bitcoin.sats')}
          </SSText>
        </SSHStack>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>{max}</SSText>
          <SSText color="muted">{t('bitcoin.sats')}</SSText>
        </SSHStack>
      </SSHStack>
      <Slider
        minimumValue={min}
        maximumValue={max}
        value={localValue}
        onValueChange={(value) => {
          const sats = value[0]
          setLocalValue(sats)
          setLocalFiatValue(satsToFiat(sats))
        }}
        onSlidingComplete={(value) => onValueChange(value[0])}
        trackStyle={styles.track}
        thumbStyle={styles.thumb}
        minimumTrackTintColor={Colors.white}
        maximumTrackTintColor={Colors.gray[600]}
        thumbTintColor={Colors.white}
        step={1}
      />
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 12,
    borderRadius: 6
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11
  },
  switchable: {
    textDecorationLine: 'underline'
  }
})

export default SSAmountInput
