import {
  SANKEY_CURRENT_TX_EXTENT_TOP_PX,
  SANKEY_OVERLAY_HEADER_GAP_PX
} from '@/constants/sankey'
import { getSankeyExtentTopPx } from '@/utils/sankeyExtent'

describe('getSankeyExtentTopPx', () => {
  it('sits below a measured overlay header', () => {
    expect(getSankeyExtentTopPx(100)).toBe(100 + SANKEY_OVERLAY_HEADER_GAP_PX)
  })

  it('falls back to the fixed top before the header is measured', () => {
    expect(getSankeyExtentTopPx()).toBe(SANKEY_CURRENT_TX_EXTENT_TOP_PX)
    expect(getSankeyExtentTopPx(0)).toBe(SANKEY_CURRENT_TX_EXTENT_TOP_PX)
  })
})
