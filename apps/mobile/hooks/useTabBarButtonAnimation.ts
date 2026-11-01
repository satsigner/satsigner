import { createContext, useContext } from 'react'
import {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'

import { selectionFromIndex } from '@/hooks/useTabBarIndicator'

const ACTIVE_OPACITY = 1
const INACTIVE_OPACITY = 0.55
const PRESS_IN_MS = 90
const PRESS_OUT_MS = 140
const PRESS_SCALE = 0.97

export const TabBarIndicatorContext = createContext<SharedValue<number> | null>(
  null
)

export function useTabBarButtonAnimation(segmentIndex: number) {
  const indicator = useContext(TabBarIndicatorContext)
  const pressed = useSharedValue(0)
  const fallback = useSharedValue(segmentIndex)

  const animatedStyle = useAnimatedStyle(() => {
    const source = indicator ?? fallback
    const selected = selectionFromIndex(source, segmentIndex)
    return {
      opacity:
        INACTIVE_OPACITY + (ACTIVE_OPACITY - INACTIVE_OPACITY) * selected,
      transform: [
        {
          scale: interpolate(
            pressed.get(),
            [0, 1],
            [1, PRESS_SCALE],
            Extrapolation.CLAMP
          )
        }
      ]
    }
  })

  function pressIn() {
    pressed.set(withTiming(1, { duration: PRESS_IN_MS }))
  }

  function pressOut() {
    pressed.set(withTiming(0, { duration: PRESS_OUT_MS }))
  }

  return { animatedStyle, pressIn, pressOut }
}

export function useTabBarIconCrossfade(segmentIndex: number) {
  const indicator = useContext(TabBarIndicatorContext)
  const fallback = useSharedValue(segmentIndex)

  const activeStyle = useAnimatedStyle(() => {
    const source = indicator ?? fallback
    return { opacity: selectionFromIndex(source, segmentIndex) }
  })
  const inactiveStyle = useAnimatedStyle(() => {
    const source = indicator ?? fallback
    return { opacity: 1 - selectionFromIndex(source, segmentIndex) }
  })

  return { activeStyle, inactiveStyle }
}
