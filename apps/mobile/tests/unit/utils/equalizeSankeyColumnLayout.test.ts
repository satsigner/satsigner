import {
  equalizeSankeyColumnsByDepthH,
  minSankeyStackedColumnInnerHeightPx
} from '@/utils/equalizeSankeyColumnLayout'

describe('minSankeyStackedColumnInnerHeightPx', () => {
  it('matches n slots and n-1 gaps', () => {
    expect(minSankeyStackedColumnInnerHeightPx(3, 80, 16)).toBe(272)
    expect(minSankeyStackedColumnInnerHeightPx(1, 80, 16)).toBe(80)
  })
})

describe('equalizeSankeyColumnsByDepthH', () => {
  it('gives equal height rows and equal gaps in a column', () => {
    const nodes = [
      { depthH: 0, id: 'a', y0: 0, y1: 10 },
      { depthH: 0, id: 'b', y0: 20, y1: 30 },
      { depthH: 0, id: 'c', y0: 40, y1: 50 }
    ]
    const top = 100
    const bottom = 400
    const H = bottom - top
    equalizeSankeyColumnsByDepthH(nodes, top, bottom, 20, 50)

    const g0 = (nodes[1].y0 ?? 0) - (nodes[0].y1 ?? 0)
    const g1 = (nodes[2].y0 ?? 0) - (nodes[1].y1 ?? 0)
    expect(g0).toBeCloseTo(g1, 5)

    const h0 = (nodes[0].y1 ?? 0) - (nodes[0].y0 ?? 0)
    const h1 = (nodes[1].y1 ?? 0) - (nodes[1].y0 ?? 0)
    const h2 = (nodes[2].y1 ?? 0) - (nodes[2].y0 ?? 0)
    expect(h0).toBeCloseTo(h1, 5)
    expect(h1).toBeCloseTo(h2, 5)

    const used = h0 + h1 + h2 + g0 + g1
    expect(used).toBeCloseTo(H, 5)
  })

  it('centers a single node in the extent', () => {
    const nodes = [{ depthH: 1, id: 'b', y0: 0, y1: 40 }]
    const top = 200
    const bottom = 360
    const H = 160
    equalizeSankeyColumnsByDepthH(nodes, top, bottom, 20, 30)

    const h = (nodes[0].y1 ?? 0) - (nodes[0].y0 ?? 0)
    expect(h).toBe(40)
    expect(nodes[0].y0).toBeCloseTo(top + (H - 40) / 2, 5)
  })
})
