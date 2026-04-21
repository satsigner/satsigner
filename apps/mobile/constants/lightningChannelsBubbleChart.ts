/** Layout / drawing constants for the Lightning channels bubble chart (no magic numbers in layout util). */

/**
 * Matches `Layout.mainContainer.paddingHorizontal` (each side). Used to estimate
 * inner content width: `screenWidth * (1 - 2 * frac)` under one `SSMainLayout`.
 */
export const LIGHTNING_BUBBLE_CHART_BLEED_MARGIN_FRAC = 0.06

export const LIGHTNING_BUBBLE_CHART_LAYOUT_MAX_SIZE_PX = 520

export const LIGHTNING_BUBBLE_CHART_LAYOUT_MIN_SIZE_PX = 280

/** Remote capacity bubble (darker than local). */
export const LIGHTNING_BUBBLE_CHART_BUBBLE_FILL = '#4F4F4F'

/** Local capacity bubble (brighter than remote). */
export const LIGHTNING_BUBBLE_CHART_LOCAL_BUBBLE_FILL = '#949494'

export const LIGHTNING_BUBBLE_CHART_HUB_FILL = '#FFFFFF'

export const LIGHTNING_BUBBLE_CHART_PADDING_PX = 16

export const LIGHTNING_BUBBLE_CHART_SPOKE_GAP_PX = 10

export const LIGHTNING_BUBBLE_CHART_SPOKE_STROKE = '#A0A0A0'

export const LIGHTNING_BUBBLE_CHART_SPOKE_STROKE_WIDTH = 1

export const LIGHTNING_BUBBLE_CHART_HIT_PAD_PX = 12

export const LIGHTNING_BUBBLE_CHART_LABEL_OFFSET_PERP_PX = 12

export const LIGHTNING_BUBBLE_CHART_LABEL_OUTWARD_PAST_REMOTE_PX = 44

export const LIGHTNING_BUBBLE_CHART_LABEL_MAX_WIDTH_PX = 120

export const LIGHTNING_BUBBLE_CHART_HUB_RADIUS_FRAC_OF_MIN_HALF = 0.2

export const LIGHTNING_BUBBLE_CHART_HUB_RADIUS_MIN_PX = 52

export const LIGHTNING_BUBBLE_CHART_HUB_RADIUS_MAX_PX = 88

export const LIGHTNING_BUBBLE_CHART_MIN_LOCAL_BUBBLE_PX = 4

export const LIGHTNING_BUBBLE_CHART_MAX_LOCAL_BUBBLE_PX = 36

export const LIGHTNING_BUBBLE_CHART_MIN_REMOTE_BUBBLE_PX = 3

export const LIGHTNING_BUBBLE_CHART_MAX_REMOTE_BUBBLE_PX = 30

export const LIGHTNING_BUBBLE_CHART_FIT_MARGIN_FRAC = 0.92

export const LIGHTNING_BUBBLE_CHART_AMOUNT_ON_BUBBLE_FONT_PX = 9

export const LIGHTNING_BUBBLE_CHART_PEER_LABEL_FONT_PX = 10
