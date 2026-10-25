import {
  BLOCK_NODE_TEXT_TO_NODE_WIDTH_RATIO,
  NODE_TEXT_MIN_LAYOUT_WIDTH,
  NODE_TEXT_PADDING_LEFT
} from '@/constants/sankey'

/**
 * Width used to lay out a sankey node paragraph. Non-block nodes never get
 * narrower than NODE_TEXT_MIN_LAYOUT_WIDTH, so the amount and its unit stay on
 * one line instead of being truncated with an ellipsis.
 */
function getNodeParagraphLayoutWidth(nodeWidth: number, isBlock: boolean) {
  if (isBlock) {
    return nodeWidth * BLOCK_NODE_TEXT_TO_NODE_WIDTH_RATIO
  }
  return Math.max(
    nodeWidth - NODE_TEXT_PADDING_LEFT,
    NODE_TEXT_MIN_LAYOUT_WIDTH
  )
}

function getNodeParagraphBoxWidth(
  nodeWidth: number,
  isBlock: boolean,
  longestLine: number
) {
  if (isBlock) {
    return getNodeParagraphLayoutWidth(nodeWidth, isBlock)
  }
  return Math.max(nodeWidth - NODE_TEXT_PADDING_LEFT, longestLine)
}

/** X offset of a sankey node paragraph; block node text is centered. */
function getNodeParagraphOffsetX(nodeWidth: number, isBlock: boolean) {
  if (isBlock) {
    return (nodeWidth * (1 - BLOCK_NODE_TEXT_TO_NODE_WIDTH_RATIO)) / 2
  }
  return NODE_TEXT_PADDING_LEFT
}

export {
  getNodeParagraphBoxWidth,
  getNodeParagraphLayoutWidth,
  getNodeParagraphOffsetX
}
