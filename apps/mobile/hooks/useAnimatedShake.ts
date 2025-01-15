import { useCallback } from 'react'
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated'

export const useAnimatedShake = () => {
  const shakeTranslateX = useSharedValue(0)

  const shake = useCallback(() => {
    const translationAmount = 20
    const timingConfig = {
      duration: 60,
      easing: Easing.bezier(0.35, 0.7, 0.5, 0.7)
    }

    shakeTranslateX.value = withSequence(
      withTiming(translationAmount, timingConfig),
      withRepeat(withTiming(-translationAmount, timingConfig), 3, true),
      withSpring(0, {
        mass: 0.75
      })
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shakeStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shakeTranslateX.value }]
    }
  }, [])

  return { shake, shakeStyle }
}
