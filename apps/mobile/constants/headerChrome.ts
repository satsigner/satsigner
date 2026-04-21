import { type ViewStyle } from 'react-native'

/** Raster size for header glyphs (square); SVGs use a 24×24 viewBox. */
export const HEADER_CHROME_ICON_SIZE = 24

/** Settings (cog) icon — slightly smaller than other header chrome icons. */
export const HEADER_CHROME_SETTINGS_ICON_SIZE = 20

/** Touch target for header icon buttons (matches visual weight of settings gear). */
export const HEADER_CHROME_HIT_BOX: ViewStyle = {
  alignItems: 'center',
  height: 48,
  justifyContent: 'center',
  width: 48
}

/**
 * Native stack has no `headerLeftContainerStyle`; nudge custom chrome slightly
 * toward the screen edge (small value — too large risks overlap with safe area).
 */
export const HEADER_CHROME_EDGE_NUDGE = 6

/** Negative margin pulls the privacy eye toward the back / hamburger (tighter pair). */
export const HEADER_CHROME_EYE_TUCK = 18

/**
 * Pixels trimmed from the default native stack header height.
 * Keep `Layout.mainContainer.paddingTop` in sync (add this value there) so body
 * content stays below the header without overlap.
 */
export const HEADER_HEIGHT_TRIM_PX = 6
