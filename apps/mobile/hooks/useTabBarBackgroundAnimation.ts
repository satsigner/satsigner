import { useContext } from 'react'
import {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated'

import { TabBarIndicatorContext } from '@/hooks/useTabBarButtonAnimation'
import { selectionFromIndex } from '@/hooks/useTabBarIndicator'
import { tabIndicatorOffset } from '@/utils/tabBarIndicator'

export function useTabBarIndicatorPosition(barWidth: SharedValue<number>) {
  const indicator = useContext(TabBarIndicatorContext)
  const fallback = useSharedValue(0)

  return useAnimatedStyle(() => {
    const source = indicator ?? fallback
    const width = barWidth.get()
    return {
      opacity: width > 0 ? 1 : 0,
      transform: [{ translateX: tabIndicatorOffset(source.get(), width) }]
    }
  })
}

export function useTabBarBorderStyle(segmentIndex: number) {
  const indicator = useContext(TabBarIndicatorContext)
  const fallback = useSharedValue(segmentIndex)

  return useAnimatedStyle(() => {
    const source = indicator ?? fallback
    return { opacity: selectionFromIndex(source, segmentIndex) }
  })
}
