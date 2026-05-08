import type { SankeyLinkMinimal, SankeyNodeMinimal } from 'd3-sankey'

import type { TxNode } from '@/hooks/useNodesAndLinks'

export interface Link extends SankeyLinkMinimal<object, object> {
  source: string
  target: string
  value: number
}

export interface Node extends SankeyNodeMinimal<object, object> {
  localId?: string
  id: string
  depth?: number
  depthH: number
  address?: string
  type: string
  ioData: TxNode['ioData']
  value?: number
  txId?: string
  nextTx?: string
}

export const LINK_MAX_WIDTH = 60
export const BLOCK_WIDTH = 50
export const NODE_WIDTH = 98
export const SAFE_LIMIT_OF_INPUTS_OUTPUTS = 12

/** Vertical band height for the block node + ribbon column (clamped). */
export const SANKEY_BAND_HEIGHT_MIN_PX = 34
export const SANKEY_BAND_HEIGHT_MAX_PX = 100

/** Minimum drawn ribbon thickness so dust flows stay visible. */
export const SANKEY_RIBBON_DUST_MIN_PX = 2

/** Inner tx-size strip on block node (Skia). */
export const SANKEY_BLOCK_TX_STRIP_MAX_PX = 80

/** Minimum inner height (extent bottom − top) so the box stays valid when the window is short. */
export const SANKEY_CURRENT_TX_EXTENT_MIN_INNER_HEIGHT_PX = 120

/** Top edge Y for d3-sankey extent in SSCurrentTransactionChart (must stay below bottom Y). */
export const SANKEY_CURRENT_TX_EXTENT_TOP_PX = 200

/** Scales vertical extent vs row count (lower = tighter vertical packing). */
export const SANKEY_CURRENT_TX_EXTENT_ROW_SCALE = 0.2

/** Horizontal inset from screen edges so columns sit closer together. */
export const SANKEY_CURRENT_TX_EXTENT_X_INSET_PX = 28

/** Vertical gap between stacked nodes (d3-sankey nodePadding). */
export const SANKEY_DIAGRAM_NODE_PADDING_PX = 88

/** Minimum row height when equalizing stacked sankey columns after layout (matches card row height). */
export const SANKEY_EQUAL_ROW_MIN_SLOT_PX = 80

/** Bezier control-point extent cap in Skia link paths. */
export const SANKEY_LINK_CURVE_CONTROL_MAX_PX = 60

/** Along outgoing-unspent ribbon gradient (0–1): pure red holds until this stop, then fades to white. */
export const SANKEY_OUTGOING_UNSPENT_RIBBON_RED_PLATEAU_STOP = 0.45
