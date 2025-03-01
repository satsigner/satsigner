import { Slider } from '@miblanchard/react-native-slider'

import { Colors } from '@/styles'

type SSSliderProps = {
  min: number
  max: number
  value: number
  step?: number
  onValueChange(value: number): void
}

function SSSlider({ min, max, value, step = 1, onValueChange }: SSSliderProps) {
  return (
    <Slider
      minimumValue={min}
      maximumValue={max}
      value={value}
      step={step}
      minimumTrackTintColor={Colors.gray[800]}
      maximumTrackTintColor={Colors.gray[400]}
      thumbTintColor={Colors.gray[75]}
      onValueChange={(value) => onValueChange(value[0])}
    />
  )
}

export default SSSlider
