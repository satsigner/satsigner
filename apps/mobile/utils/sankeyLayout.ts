import {
  SANKEY_CURRENT_TX_EXTENT_TOP_PX,
  SANKEY_OVERLAY_HEADER_GAP_PX
} from '@/types/ui/sankey'

export function getSankeyExtentTopPx(overlayHeaderHeight?: number): number {
  if (overlayHeaderHeight && overlayHeaderHeight > 0) {
    return overlayHeaderHeight + SANKEY_OVERLAY_HEADER_GAP_PX
  }
  return SANKEY_CURRENT_TX_EXTENT_TOP_PX
}
