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
      containerStyle={{ width: '100%', flex: 1 }}
      minimumTrackTintColor={Colors.white}
      maximumTrackTintColor={Colors.gray[800]}
      thumbTintColor={Colors.gray[75]}
      onValueChange={(value) => onValueChange(value[0])}
      trackStyle={{ height: 12, borderRadius: 6 }}
      thumbStyle={{ width: 22, height: 22, borderRadius: 11 }}
    />
  )
}

export default SSSlider
