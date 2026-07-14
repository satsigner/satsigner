import {
  SANKEY_BAND_HEIGHT_MAX_PX,
  SANKEY_BAND_HEIGHT_MIN_PX,
  SANKEY_RIBBON_DUST_MIN_PX
} from '@/types/ui/sankey'
import {
  buildSankeyRibbonPlan,
  linearShareWidths,
  linkRibbonKey,
  ribbonWidthForLink,
  totalThroughputToBandHeight
} from '@/utils/sankeyFlowWidths'

describe('linearShareWidths', () => {
  it('splits budget proportionally', () => {
    const w = linearShareWidths([1000, 2000], 90)
    expect(w[0]).toBeCloseTo(30, 5)
    expect(w[1]).toBeCloseTo(60, 5)
    expect(w[0] + w[1]).toBeCloseTo(90, 5)
  })

  it('uses uniform split when values sum to zero', () => {
    const w = linearShareWidths([0, 0], 40)
    expect(w[0]).toBe(20)
    expect(w[1]).toBe(20)
  })

  it('rescales after dust floor so total matches budget', () => {
    const w = linearShareWidths([1, 999], 100, SANKEY_RIBBON_DUST_MIN_PX)
    expect(w[0] + w[1]).toBeCloseTo(100, 5)
    expect(w[0]).toBeLessThan(w[1])
    expect(w[0]).toBeGreaterThan(1)
  })
})

describe('totalThroughputToBandHeight', () => {
  it('clamps to sankey band range', () => {
    expect(totalThroughputToBandHeight(0)).toBe(SANKEY_BAND_HEIGHT_MIN_PX)
    const mid = totalThroughputToBandHeight(50000)
    expect(mid).toBeGreaterThanOrEqual(SANKEY_BAND_HEIGHT_MIN_PX)
    expect(mid).toBeLessThanOrEqual(SANKEY_BAND_HEIGHT_MAX_PX)
  })
})

describe('buildSankeyRibbonPlan', () => {
  it('assigns consistent widths for input and output sides of one block', () => {
    const nodes = [
      { id: '1', type: 'text', value: 1000 },
      { id: '2', type: 'text', value: 2000 },
      { id: 'b', type: 'block', value: 3000 },
      { id: '3', type: 'text', value: 2000 },
      { id: '4', type: 'text', value: 1000 }
    ]
    const links = [
      { source: '1', target: 'b', value: 1000 },
      { source: '2', target: 'b', value: 2000 },
      { source: 'b', target: '3', value: 2000 },
      { source: 'b', target: '4', value: 1000 }
    ]
    const plan = buildSankeyRibbonPlan(nodes, links)
    const H = plan.bandHeightByBlockId.get('b') ?? SANKEY_BAND_HEIGHT_MIN_PX

    const in1 = ribbonWidthForLink(plan, '1', 'b')
    const in2 = ribbonWidthForLink(plan, '2', 'b')
    expect(in1 + in2).toBeCloseTo(H, 5)
    expect(in1 / in2).toBeCloseTo(0.5, 5)

    const out3 = ribbonWidthForLink(plan, 'b', '3')
    const out4 = ribbonWidthForLink(plan, 'b', '4')
    expect(out3 + out4).toBeCloseTo(H, 5)

    expect(plan.linkWidthByKey.has(linkRibbonKey('1', 'b'))).toBe(true)
  })

  it('scales input ribbons smaller when inputs are less than outputs', () => {
    const nodes = [
      { id: '1', type: 'text', value: 1000 },
      { id: 'b', type: 'block', value: 1000 },
      { id: '2', type: 'text', value: 2000 },
      { id: '3', type: 'text', value: 1000 }
    ]
    const links = [
      { source: '1', target: 'b', value: 1000 },
      { source: 'b', target: '2', value: 2000 },
      { source: 'b', target: '3', value: 1000 }
    ]
    const plan = buildSankeyRibbonPlan(nodes, links)
    const H = plan.bandHeightByBlockId.get('b') ?? SANKEY_BAND_HEIGHT_MIN_PX

    const inputWidth = ribbonWidthForLink(plan, '1', 'b')
    const outputWidths =
      ribbonWidthForLink(plan, 'b', '2') + ribbonWidthForLink(plan, 'b', '3')

    expect(inputWidth).toBeCloseTo(H / 3, 5)
    expect(outputWidths).toBeCloseTo(H, 5)
    expect(inputWidth).toBeLessThan(outputWidths)
  })
})
