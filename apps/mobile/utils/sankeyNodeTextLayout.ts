/** Block node text spans this share of the node width. */
const BLOCK_TEXT_WIDTH_RATIO = 0.6
/** Extra layout width so amount + unit can paint past the sankey node band. */
const NODE_TEXT_OVERFLOW_WIDTH = 220

/**
 * Width used to lay out a sankey node paragraph. Non-block nodes never get
 * narrower than NODE_TEXT_OVERFLOW_WIDTH, so the amount and its unit stay on
 * one line instead of being truncated with an ellipsis.
 */
function getNodeParagraphLayoutWidth(
  nodeWidth: number,
  paddingLeft: number,
  isBlock: boolean
) {
  if (isBlock) {
    return nodeWidth * BLOCK_TEXT_WIDTH_RATIO
  }
  return Math.max(nodeWidth - paddingLeft, NODE_TEXT_OVERFLOW_WIDTH)
}

/** X offset of a sankey node paragraph; block node text is centered. */
function getNodeParagraphOffsetX(
  nodeWidth: number,
  paddingLeft: number,
  isBlock: boolean
) {
  if (isBlock) {
    return (nodeWidth * (1 - BLOCK_TEXT_WIDTH_RATIO)) / 2
  }
  return paddingLeft
}

export {
  getNodeParagraphLayoutWidth,
  getNodeParagraphOffsetX,
  NODE_TEXT_OVERFLOW_WIDTH
}
