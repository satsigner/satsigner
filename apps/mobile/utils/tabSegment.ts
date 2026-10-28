import { t } from '@/locales'
import {
  DEFAULT_TAB_SEGMENT,
  TAB_SEGMENTS,
  type TabSegment
} from '@/types/navigation/tabs'

/**
 * Whether a route segment is one of the bottom tabs. Pass it to
 * `useSegments().find` to get the active tab.
 */
export function isTabSegment(segment: string): segment is TabSegment {
  return TAB_SEGMENTS.some((tabSegment) => tabSegment === segment)
}

export function toTabSegment(segment: string | undefined): TabSegment {
  if (!segment || !isTabSegment(segment)) {
    return DEFAULT_TAB_SEGMENT
  }
  return segment
}

export function getTabSegmentLabel(segment: TabSegment): string {
  const labels: Record<TabSegment, string> = {
    '(converter)': t('navigation.label.converter'),
    '(explorer)': t('navigation.label.explorer'),
    '(signer)': t('navigation.label.signer')
  }
  return labels[segment]
}
