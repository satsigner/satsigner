import { TAB_SEGMENTS, type TabSegment } from '@/types/navigation/tabs'

/**
 * Whether a route segment is one of the bottom tabs. Pass it to
 * `useSegments().find` to get the active tab.
 */
export function isTabSegment(segment: string): segment is TabSegment {
  return TAB_SEGMENTS.some((tabSegment) => tabSegment === segment)
}
