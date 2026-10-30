import { Slider } from '@miblanchard/react-native-slider'
import { useState } from 'react'
import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { DisplayPreferences } from '@/types/ui/displayPreferences'
import { satsToFiat } from '@/utils/fiat'
import { formatNumber } from '@/utils/format'

import SSNumberGhostInput from './SSNumberGhostInput'
import SSText from './SSText'

type SSFeeInputProps = Pick<DisplayPreferences, 'btcPrice' | 'fiatEnabled'> & {
  max: number
  min?: number
  inputMax?: number
  estimatedBlock?: number
  vbytes?: number
  value: number
  fiatCurrency: string
  onValueChange: (value: number) => void
}

function SSFeeInput({
  max,
  min = 1,
  inputMax,
  estimatedBlock,
  vbytes,
  value,
  fiatCurrency,
  btcPrice,
  fiatEnabled,
  onValueChange
}: SSFeeInputProps) {
  const [slidingValue, setSlidingValue] = useState<number>()
  const ghostInputMax = inputMax ?? max
  const feeRate = slidingValue ?? value

  return (
    <SSVStack gap="sm">
      <SSNumberGhostInput
        min={min}
        max={ghostInputMax}
        suffix={t('bitcoin.satVb')}
        allowDecimal
        value={String(feeRate)}
        onChangeText={(text) => onValueChange(Number(text))}
      />
      <SSHStack justifyBetween>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>{min}</SSText>
          <SSText color="muted">{t('bitcoin.sat')}</SSText>
        </SSHStack>
        <SSHStack gap="sm">
          {vbytes && (
            <SSHStack style={{ alignItems: 'center' }} gap="md">
              <SSHStack style={{ justifyContent: 'center' }} gap="xxs">
                <SSText>{Math.trunc(vbytes * feeRate)}</SSText>
                <SSText color="muted">{t('bitcoin.sats')}</SSText>
              </SSHStack>
              <SSHStack style={{ justifyContent: 'center' }} gap="xxs">
                <SSText>
                  {formatNumber(
                    satsToFiat(
                      Math.trunc(vbytes * feeRate),
                      btcPrice,
                      fiatEnabled
                    ),
                    2
                  )}
                </SSText>
                <SSText color="muted">{fiatCurrency}</SSText>
              </SSHStack>
            </SSHStack>
          )}
          {estimatedBlock && (
            <SSHStack style={{ justifyContent: 'center' }} gap="xs">
              <SSText color="muted">~</SSText>
              <SSText>{estimatedBlock}</SSText>
              <SSText color="muted">{t('bitcoin.blocks')}</SSText>
            </SSHStack>
          )}
        </SSHStack>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>{ghostInputMax}</SSText>
          <SSText color="muted">{t('bitcoin.satVb')}</SSText>
        </SSHStack>
      </SSHStack>
      <Slider
        minimumValue={min}
        maximumValue={max}
        value={feeRate}
        onValueChange={(value) => setSlidingValue(value[0])}
        onSlidingComplete={(value) => {
          onValueChange(value[0])
          setSlidingValue(undefined)
        }}
        trackStyle={styles.track}
        thumbStyle={styles.thumb}
        minimumTrackTintColor={Colors.white}
        thumbTintColor={Colors.white}
        maximumTrackTintColor={Colors.gray[600]}
        step={1}
      />
    </SSVStack>
  )
}

const size = 15

const styles = StyleSheet.create({
  thumb: {
    borderRadius: size,
    height: size * 2,
    width: size * 2
  },
  track: {
    borderRadius: size / 2,
    height: size
  }
})

export default SSFeeInput
