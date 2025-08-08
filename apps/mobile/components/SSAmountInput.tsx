import { Slider } from '@miblanchard/react-native-slider'
import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

import SSNumberGhostInput from './SSNumberGhostInput'
import SSText from './SSText'

type SSAmountInputProps = {
  min: number
  max: number
  value: number
  onValueChange: (value: number) => void
  remainingSats?: number
}

function SSAmountInput({
  min,
  max,
  value,
  onValueChange,
  remainingSats
}: SSAmountInputProps) {
  const [localValue, setLocalValue] = useState(min)
  const [isSliding, setIsSliding] = useState(false)

  useEffect(() => {
    if (value === min) {
      setLocalValue(min)
    } else {
      setLocalValue(value)
    }
  }, [value, min])

  return (
    <SSVStack gap="sm">
      <SSNumberGhostInput
        min={min}
        max={max}
        suffix={t('bitcoin.sats')}
        allowDecimal={false}
        value={String(Math.round(localValue))}
        onChangeText={(text) => {
          const newValue = Math.round(Number(text))
          if (newValue >= min && newValue <= max) {
            setLocalValue(newValue)
            onValueChange(newValue)
          }
        }}
      />
      <SSHStack justifyBetween>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>{Math.round(min)}</SSText>
          <SSText color="muted">{t('bitcoin.sats')}</SSText>
        </SSHStack>
        {remainingSats !== undefined && (
          <SSHStack style={{ justifyContent: 'center' }} gap="xs">
            <SSText color="muted">
              {t('common.remaining')} {Math.round(remainingSats - localValue)}
            </SSText>
            <SSText color="muted">{t('bitcoin.sats')}</SSText>
          </SSHStack>
        )}
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>{Math.round(max)}</SSText>
          <SSText color="muted">{t('bitcoin.sats')}</SSText>
        </SSHStack>
      </SSHStack>
      <Slider
        minimumValue={min}
        maximumValue={max}
        value={Math.round(localValue)}
        onValueChange={(value) => {
          const newValue = Math.round(value[0])
          setLocalValue(newValue)
          if (!isSliding) {
            onValueChange(newValue)
          }
        }}
        onSlidingStart={() => setIsSliding(true)}
        onSlidingComplete={(value) => {
          const finalValue = Math.round(value[0])
          setLocalValue(finalValue)
          onValueChange(finalValue)
          setIsSliding(false)
        }}
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

export default SSAmountInput
