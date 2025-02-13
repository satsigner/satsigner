import { type SharedValue } from 'react-native-reanimated'

function clamp(value: number, min: number, max: number) {
  'worklet'

  return Math.min(Math.max(min, value), max)
}

function right(width: number, scale: SharedValue<number>) {
  'worklet'

  return (width * (scale.value - 1)) / 2
}

function left(width: number, scale: SharedValue<number>) {
  'worklet'

  return -right(width, scale)
}

function bottom(height: number, scale: SharedValue<number>) {
  'worklet'

  return (height * (scale.value - 1)) / 2
}

function top(height: number, scale: SharedValue<number>) {
  'worklet'

  return -bottom(height, scale)
}

function sum(...animatedValues: SharedValue<number>[]) {
  'worklet'

  return animatedValues.reduce(
    (result, animatedValue) => result + animatedValue.value,
    0
  )
}

const limits = { right, left, top, bottom }

export { clamp, limits, sum }
