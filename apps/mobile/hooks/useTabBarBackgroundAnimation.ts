import {
  useAnimatedStyle,
  useDerivedValue,
  withTiming
} from 'react-native-reanimated'

import { type TabSegment } from '@/types/navigation/tabs'

const OPACITY_DURATION = 180

export function useTabBarBackgroundAnimation(
  activeSegment: TabSegment | undefined
) {
  const explorerOpacity = useDerivedValue(() =>
    withTiming(activeSegment === '(explorer)' ? 1 : 0, {
      duration: OPACITY_DURATION
    })
  )
  const signerOpacity = useDerivedValue(() =>
    withTiming(activeSegment === '(signer)' ? 1 : 0, {
      duration: OPACITY_DURATION
    })
  )
  const converterOpacity = useDerivedValue(() =>
    withTiming(activeSegment === '(converter)' ? 1 : 0, {
      duration: OPACITY_DURATION
    })
  )

  const explorerStyle = useAnimatedStyle(() => ({
    opacity: explorerOpacity.value
  }))
  const signerStyle = useAnimatedStyle(() => ({ opacity: signerOpacity.value }))
  const converterStyle = useAnimatedStyle(() => ({
    opacity: converterOpacity.value
  }))

  return {
    '(converter)': converterStyle,
    '(explorer)': explorerStyle,
    '(signer)': signerStyle
  } as const
}
