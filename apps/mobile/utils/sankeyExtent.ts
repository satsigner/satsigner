import {
  SANKEY_CURRENT_TX_EXTENT_TOP_PX,
  SANKEY_OVERLAY_HEADER_GAP_PX
} from '@/constants/sankey'

/**
 * Top edge Y of the d3-sankey extent. Sits just below the overlay header once
 * its height is measured, and falls back to a fixed top before that.
 */
function getSankeyExtentTopPx(overlayHeaderHeight?: number) {
  if (overlayHeaderHeight && overlayHeaderHeight > 0) {
    return overlayHeaderHeight + SANKEY_OVERLAY_HEADER_GAP_PX
  }
  return SANKEY_CURRENT_TX_EXTENT_TOP_PX
}

export { getSankeyExtentTopPx }
