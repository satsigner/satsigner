import { useEffect, useRef } from 'react'
import {
  type SharedValue,
  useSharedValue,
  withSpring
} from 'react-native-reanimated'

import { type TabSegment } from '@/types/navigation/tabs'
import { tabSegmentIndex } from '@/utils/tabBarIndicator'

export const TAB_INDICATOR_SPRING = {
  damping: 20,
  mass: 0.8,
  stiffness: 220
}

export function useTabBarIndicator(activeSegment: TabSegment | undefined) {
  const index = useSharedValue(tabSegmentIndex(activeSegment))
  const hasSettledInitial = useRef(false)

  useEffect(() => {
    if (activeSegment === undefined) {
      return
    }
    const next = tabSegmentIndex(activeSegment)
    if (!hasSettledInitial.current) {
      hasSettledInitial.current = true
      index.set(next)
      return
    }
    index.set(withSpring(next, TAB_INDICATOR_SPRING))
  }, [activeSegment, index])

  return index
}

export function selectionFromIndex(
  indicator: SharedValue<number>,
  segmentIndex: number
) {
  'worklet'
  const position = indicator.get()
  if (position <= segmentIndex - 1 || position >= segmentIndex + 1) {
    return 0
  }
  if (position <= segmentIndex) {
    return position - (segmentIndex - 1)
  }
  return segmentIndex + 1 - position
}
