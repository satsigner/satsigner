import { Slider } from '@miblanchard/react-native-slider'
import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'

import SSText from './SSText'

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
  return (
    <SSVStack gap="sm">
      <SSHStack style={{ justifyContent: 'center' }} gap="sm">
        <SSText size="lg">{Math.trunc(value)}</SSText>
        <SSText size="lg" color="muted">
          sats/vB
        </SSText>
      </SSHStack>
      <SSHStack justifyBetween>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>1</SSText>
          <SSText color="muted">sat</SSText>
        </SSHStack>
        <SSHStack>
          {vbytes && (
            <SSHStack style={{ justifyContent: 'center' }} gap="xs">
              <SSText>{Math.round(vbytes * value)}</SSText>
              <SSText color="muted">sats</SSText>
            </SSHStack>
          )}
          {estimatedBlock && (
            <SSHStack style={{ justifyContent: 'center' }} gap="xs">
              <SSText color="muted">~</SSText>
              <SSText>{estimatedBlock}</SSText>
              <SSText color="muted">sats</SSText>
            </SSHStack>
          )}
        </SSHStack>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>{max}</SSText>
          <SSText color="muted">sats</SSText>
        </SSHStack>
      </SSHStack>
      <Slider
        minimumValue={1}
        maximumValue={max}
        value={value}
        onValueChange={(value) => onValueChange(value[0])}
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
