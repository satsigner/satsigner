import type { SankeyNode } from 'd3-sankey'

import type { TxNode } from '@/hooks/useNodesAndLinks'

/**
 * Chart node after d3-sankey layout: the `TxNode` it was built from plus the
 * computed position (x0/x1/y0/y1). Build layouts with `sankey<TxNode, object>()`
 * (links carry no extra fields) to get these nodes back.
 */
export type Node = SankeyNode<TxNode, object>

/** Wallet role of a sankey output node, from `getSankeyOutputRole`. */
export type SankeyOutputRole = {
  isChange: boolean
  isFakeMix: boolean
  isReceive: boolean
  isSelfSend: boolean
}
