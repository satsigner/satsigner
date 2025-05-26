import { Slider } from '@miblanchard/react-native-slider'
import { useEffect, useState } from 'react'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

import SSText from './SSText'

type SSSliderProps = {
  min: number
  max: number
  value: number
  step?: number
  suffix?: string
  onValueChange(value: number): void
}

function SSSlider({
  min,
  max,
  value,
  step = 1,
  suffix,
  onValueChange
}: SSSliderProps) {
  const [localValue, setLocalValue] = useState(value)

  // Update local value when prop value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <SSVStack gap="sm">
      <SSHStack justifyBetween>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>{min}</SSText>
          {suffix && <SSText color="muted">{suffix}</SSText>}
        </SSHStack>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>{localValue}</SSText>
          {suffix && <SSText color="muted">{suffix}</SSText>}
        </SSHStack>
        <SSHStack style={{ justifyContent: 'center' }} gap="xs">
          <SSText>{max}</SSText>
          {suffix && <SSText color="muted">{suffix}</SSText>}
        </SSHStack>
      </SSHStack>
      <Slider
        minimumValue={min}
        maximumValue={max}
        value={localValue}
        step={step}
        containerStyle={{ width: '100%', flex: 1 }}
        minimumTrackTintColor={Colors.white}
        maximumTrackTintColor={Colors.gray[800]}
        thumbTintColor={Colors.white}
        onValueChange={(value) => {
          const newValue = value[0]
          setLocalValue(newValue)
          onValueChange(newValue)
        }}
        trackStyle={{ height: 12, borderRadius: 6 }}
        thumbStyle={{ width: 22, height: 22, borderRadius: 11 }}
      />
    </SSVStack>
  )
}

export default SSSlider
