import { Slider } from '@miblanchard/react-native-slider'
import { useState } from 'react'
import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

import SSNumberGhostInput from './SSNumberGhostInput'
import SSText from './SSText'

type SSFeeInputProps = {
  max: number
  estimatedBlock?: number
  vbytes?: number
  value: number
  onValueChange: (value: number) => void
}

function SSFeeInput({
  max,
  estimatedBlock,
  vbytes,
  value,
  onValueChange
}: SSFeeInputProps) {
  const [localValue, setLocalValue] = useState(value)

  return (
    <SSVStack gap="sm">
      <SSNumberGhostInput
        min={1}
        max={max}
        suffix={t('bitcoin.satVb')}
        allowDecimal
        value={String(localValue)}
        onChangeText={(text) => setLocalValue(Number(text))}
      />
      <SSHStack justifyBetween>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>1</SSText>
          <SSText color="muted">{t('bitcoin.sat')}</SSText>
        </SSHStack>
        <SSHStack>
          {vbytes && (
            <SSHStack style={{ justifyContent: 'center' }} gap="xs">
              <SSText>{Math.trunc(vbytes * localValue)}</SSText>
              <SSText color="muted">{t('bitcoin.sats')}</SSText>
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
          <SSText>{max}</SSText>
          <SSText color="muted">{t('bitcoin.sats')}</SSText>
        </SSHStack>
      </SSHStack>
      <Slider
        minimumValue={1}
        maximumValue={max}
        value={localValue}
        onValueChange={(value) => setLocalValue(value[0])}
        onSlidingComplete={() => onValueChange(localValue)}
        trackStyle={styles.track}
        thumbStyle={styles.thumb}
        minimumTrackTintColor="#fff"
        thumbTintColor="#fff"
        maximumTrackTintColor={Colors.gray[600]}
        step={1}
      />
    </SSVStack>
  )
}

const size = 15

const styles = StyleSheet.create({
  track: {
    height: size,
    borderRadius: size / 2
  },
  thumb: {
    height: size * 2,
    width: size * 2,
    borderRadius: size
  }
})

export default SSFeeInput
