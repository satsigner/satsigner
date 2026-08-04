import {
  feesFromProjectedBlocks,
  normalizeHistogram,
  projectedBlocksFromHistogram
} from '@/utils/mempoolHistogram'

describe('normalizeHistogram', () => {
  it('keeps finite positive bands', () => {
    expect(
      normalizeHistogram([
        [10, 100],
        ['bad', 1],
        [5, 0],
        [3, 50]
      ])
    ).toStrictEqual([
      [10, 100],
      [3, 50]
    ])
  })

  it('returns empty for non-arrays', () => {
    expect(normalizeHistogram(null)).toStrictEqual([])
  })
})

describe('projectedBlocksFromHistogram', () => {
  it('returns empty for an empty histogram', () => {
    expect(projectedBlocksFromHistogram([])).toStrictEqual([])
  })

  it('packs highest fees into the first 1 MvB bucket', () => {
    const blocks = projectedBlocksFromHistogram([
      [50, 400_000],
      [20, 700_000],
      [5, 300_000]
    ])

    expect(blocks).toHaveLength(2)
    expect(blocks[0]?.blockVSize).toBe(1_000_000)
    expect(blocks[0]?.feeRange[0]).toBe(20)
    expect(blocks[1]?.blockVSize).toBe(400_000)
    expect(blocks[1]?.feeRange[0]).toBe(5)
  })

  it('caps the number of projected blocks', () => {
    const bands: [number, number][] = Array.from({ length: 40 }, (_, i) => [
      100 - i,
      1_000_000
    ])
    expect(projectedBlocksFromHistogram(bands)).toHaveLength(24)
  })
})

describe('feesFromProjectedBlocks', () => {
  it('returns null when there are no blocks', () => {
    expect(feesFromProjectedBlocks([])).toBeNull()
  })

  it('maps the first three blocks to high/medium/low tiers', () => {
    const blocks = projectedBlocksFromHistogram([
      [40, 1_000_000],
      [15, 1_000_000],
      [4, 1_000_000]
    ])

    expect(feesFromProjectedBlocks(blocks, 1)).toStrictEqual({
      high: 40,
      low: 4,
      medium: 15,
      none: 1
    })
  })
})
