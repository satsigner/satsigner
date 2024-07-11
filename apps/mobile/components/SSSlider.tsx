import Slider from '@react-native-community/slider'
import { type StyleProp, ViewStyle } from 'react-native'

import { Colors } from '@/styles'

type SSSliderProps = {
  min: number
  max: number
  value: number
  step?: number
  onValueChange(value: number): void
  style?: StyleProp<ViewStyle>
}

export default function SSSlider({
  max,
  min,
  value,
  step = 1,
  onValueChange,
  style
}: SSSliderProps) {
  return (
    <Slider
      minimumValue={min}
      maximumValue={max}
      value={value}
      step={step}
      minimumTrackTintColor={Colors.gray[800]}
      maximumTrackTintColor={Colors.gray[400]}
      thumbTintColor={Colors.white}
      onValueChange={(value) => onValueChange(value)}
      style={style}
    />
  )
}
