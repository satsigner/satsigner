import {
  DEFAULT_TAB_SEGMENT,
  TAB_SEGMENTS,
  type TabSegment
} from '@/types/navigation/tabs'

export const TAB_BAR_ITEM_WIDTH = 100
export const TAB_BAR_INDICATOR_RADIUS = 5

const TAB_COUNT = TAB_SEGMENTS.length

export function tabSegmentIndex(segment: TabSegment | undefined) {
  if (!segment) {
    return TAB_SEGMENTS.indexOf(DEFAULT_TAB_SEGMENT)
  }
  const index = TAB_SEGMENTS.indexOf(segment)
  return index === -1 ? TAB_SEGMENTS.indexOf(DEFAULT_TAB_SEGMENT) : index
}

export function tabIndicatorOffset(index: number, barWidth: number) {
  'worklet'
  if (barWidth <= 0) {
    return 0
  }
  const slot = barWidth / TAB_COUNT
  return index * slot + (slot - TAB_BAR_ITEM_WIDTH) / 2
}
