import { Slider } from '@miblanchard/react-native-slider'
import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'

import SSText from './SSText'
import { t } from '@/locales'
import { useState } from 'react'

type SSFeeInputProps = {
  max: number
  estimatedBlock?: number
  vbytes?: number
  value: number
  onValueChange: (val: number) => void
}

// TODO: improve performance, extremely slow

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
      <SSHStack style={{ justifyContent: 'center' }} gap="sm">
        <SSText size="lg">{Math.round(localValue)}</SSText>
        <SSText size="lg" color="muted">
          {t('bitcoin.satVb')}
        </SSText>
      </SSHStack>
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
