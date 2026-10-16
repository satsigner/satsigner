import {
  getNodeParagraphLayoutWidth,
  getNodeParagraphOffsetX,
  NODE_TEXT_OVERFLOW_WIDTH
} from '@/utils/sankeyNodeTextLayout'

describe('getNodeParagraphLayoutWidth', () => {
  it('keeps narrow output nodes wide enough for amount and unit', () => {
    expect(getNodeParagraphLayoutWidth(40, 8, false)).toBe(
      NODE_TEXT_OVERFLOW_WIDTH
    )
  })

  it('uses the node width when it is wider than the overflow width', () => {
    expect(getNodeParagraphLayoutWidth(300, 8, false)).toBe(292)
  })

  it('uses a share of the node width for block nodes', () => {
    expect(getNodeParagraphLayoutWidth(100, 8, true)).toBe(60)
  })
})

describe('getNodeParagraphOffsetX', () => {
  it('centers block node text', () => {
    const width = 100
    const offset = getNodeParagraphOffsetX(width, 8, true)
    const textWidth = getNodeParagraphLayoutWidth(width, 8, true)
    expect(offset * 2 + textWidth).toBeCloseTo(width)
  })

  it('uses the left padding for other nodes', () => {
    expect(getNodeParagraphOffsetX(100, 8, false)).toBe(8)
  })
})
