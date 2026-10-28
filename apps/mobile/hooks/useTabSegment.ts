import { createContext, use } from 'react'

import { DEFAULT_TAB_SEGMENT, type TabSegment } from '@/types/navigation/tabs'

// Each bottom tab mounts its own copy of the shared stack, so the stack layout
// provides its tab here. `useSegments()` would report the focused tab instead.
export const TabSegmentContext = createContext<TabSegment>(DEFAULT_TAB_SEGMENT)

export function useTabSegment(): TabSegment {
  return use(TabSegmentContext)
}
