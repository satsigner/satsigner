/** Block node text spans this share of the node width. */
const BLOCK_TEXT_WIDTH_RATIO = 0.6
/** Extra layout width so amount + unit can paint past the sankey node band. */
const NODE_TEXT_OVERFLOW_WIDTH = 220

/**
 * Width used to lay out a sankey node paragraph. Non-block nodes never get
 * narrower than NODE_TEXT_OVERFLOW_WIDTH, so the amount and its unit stay on
 * one line instead of being truncated with an ellipsis.
 */
export function getNodeParagraphLayoutWidth(
  nodeWidth: number,
  paddingLeft: number,
  isBlock: boolean
) {
  if (isBlock) {
    return nodeWidth * BLOCK_TEXT_WIDTH_RATIO
  }
  return Math.max(nodeWidth - paddingLeft, NODE_TEXT_OVERFLOW_WIDTH)
}

export { NODE_TEXT_OVERFLOW_WIDTH }
