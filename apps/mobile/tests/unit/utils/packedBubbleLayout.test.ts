import {
  buildPackedBubbleLayout,
  type PackedBubbleDatum
} from '@/utils/packedBubbleLayout'

const data: PackedBubbleDatum[] = [
  { id: 'a', label: '3000', value: 3000 },
  { id: 'b', label: '1000', locked: true, value: 1000 },
  { id: 'c', label: '2000', selected: true, value: 2000 }
]

describe('buildPackedBubbleLayout', () => {
  it('packs every datum into a leaf and preserves its data', () => {
    const { chartSize, leaves } = buildPackedBubbleLayout(data, 300, 240)

    expect(chartSize).toBe(240)
    expect(leaves).toHaveLength(3)
    expect(leaves.map((leaf) => leaf.id).toSorted()).toStrictEqual([
      'a',
      'b',
      'c'
    ])
    expect(leaves.find((leaf) => leaf.id === 'b')?.datum.locked).toBe(true)
    expect(leaves.find((leaf) => leaf.id === 'c')?.datum.selected).toBe(true)
  })

  it('enforces a minimum radius so tiny values stay tappable', () => {
    const { leaves } = buildPackedBubbleLayout(
      [
        { id: 'big', label: '1000000', value: 1_000_000 },
        { id: 'tiny', label: '1', value: 1 }
      ],
      300,
      300
    )

    const tiny = leaves.find((leaf) => leaf.id === 'tiny')
    expect(tiny?.r).toBeGreaterThanOrEqual(16)
  })

  it('returns no leaves for empty input', () => {
    expect(buildPackedBubbleLayout([], 300, 300).leaves).toHaveLength(0)
  })
})
