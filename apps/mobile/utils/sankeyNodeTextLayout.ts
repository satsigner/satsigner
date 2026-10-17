import {
  BLOCK_TEXT_WIDTH_RATIO,
  NODE_TEXT_OVERFLOW_WIDTH
} from '@/constants/sankey'

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

export { getNodeParagraphLayoutWidth, getNodeParagraphOffsetX }
