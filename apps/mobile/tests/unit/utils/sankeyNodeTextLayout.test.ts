import {
  getNodeParagraphLayoutWidth,
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
