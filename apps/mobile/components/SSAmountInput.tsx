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
  satsToFiat: (sats: number) => number
  onValueChange: (value: number) => void
}

function SSAmountInput({
  min,
  max,
  value,
  remainingSats,
  fiatCurrency,
  satsToFiat,
  onValueChange
}: SSAmountInputProps) {
  const [localValue, setLocalValue] = useState(value)

  function handleValueChange(newValue: number) {
    setLocalValue(newValue)
    onValueChange(newValue)
  }

  const remainingValue = remainingSats - localValue

  return (
    <SSVStack gap="none">
      <SSNumberGhostInput
        min={min}
        max={max}
        suffix={t('bitcoin.sats')}
        allowDecimal={false}
        value={String(localValue)}
        onChangeText={(text) => handleValueChange(Number(text))}
      />
      <SSHStack gap="xs" style={{ justifyContent: 'center' }}>
        <SSText color="muted" size="lg">
          {formatNumber(satsToFiat(localValue), 2)} {fiatCurrency}
        </SSText>
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
        onValueChange={(value) => setLocalValue(value[0])}
        onSlidingComplete={() => onValueChange(localValue)}
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
  }
})

export default SSAmountInput
