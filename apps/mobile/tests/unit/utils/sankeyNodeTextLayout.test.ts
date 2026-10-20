import {
  NODE_TEXT_MIN_LAYOUT_WIDTH,
  NODE_TEXT_PADDING_LEFT,
  NODE_WIDTH
} from '@/constants/sankey'
import {
  getNodeParagraphBoxWidth,
  getNodeParagraphLayoutWidth,
  getNodeParagraphOffsetX
} from '@/utils/sankeyNodeTextLayout'

describe('getNodeParagraphLayoutWidth', () => {
  it('keeps output nodes wide enough for amount and unit', () => {
    expect(getNodeParagraphLayoutWidth(NODE_WIDTH, false)).toBe(
      NODE_TEXT_MIN_LAYOUT_WIDTH
    )
  })

  it('uses the padded node width when it is wider than the minimum layout width', () => {
    expect(getNodeParagraphLayoutWidth(300, false)).toBe(
      300 - NODE_TEXT_PADDING_LEFT
    )
  })

  it('uses a share of the node width for block nodes', () => {
    expect(getNodeParagraphLayoutWidth(100, true)).toBe(60)
  })
})

describe('getNodeParagraphBoxWidth', () => {
  it('matches the layout width for block nodes', () => {
    expect(getNodeParagraphBoxWidth(100, true, 500)).toBe(
      getNodeParagraphLayoutWidth(100, true)
    )
  })

  it('grows to fit the longest line of other nodes', () => {
    expect(getNodeParagraphBoxWidth(NODE_WIDTH, false, 150)).toBe(150)
  })

  it('never gets narrower than the padded node width', () => {
    expect(getNodeParagraphBoxWidth(NODE_WIDTH, false, 10)).toBe(
      NODE_WIDTH - NODE_TEXT_PADDING_LEFT
    )
  })
})

describe('getNodeParagraphOffsetX', () => {
  it('centers block node text', () => {
    const width = 100
    const offset = getNodeParagraphOffsetX(width, true)
    const textWidth = getNodeParagraphLayoutWidth(width, true)
    expect(offset * 2 + textWidth).toBeCloseTo(width)
  })

  it('uses the left padding for other nodes', () => {
    expect(getNodeParagraphOffsetX(100, false)).toBe(NODE_TEXT_PADDING_LEFT)
  })
})
