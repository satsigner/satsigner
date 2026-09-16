import {
  allocateMppSlices,
  type MintSpendBalance,
  selectMintRoute
} from '@/utils/ecashMintRoute'

function mint(
  mintUrl: string,
  balance: number,
  supportsMpp: boolean
): MintSpendBalance {
  return { balance, mintUrl, supportsMpp }
}

describe('ecash mint route', () => {
  it('uses the selected mint when it covers the amount', () => {
    const route = selectMintRoute({
      allowMpp: true,
      amountSats: 100,
      mints: [mint('a', 50, true), mint('b', 200, true)],
      selectedMintUrl: 'b'
    })

    expect(route).toStrictEqual({ kind: 'single', mintUrl: 'b' })
  })

  it('falls back to the highest covering mint', () => {
    const route = selectMintRoute({
      allowMpp: false,
      amountSats: 80,
      mints: [
        mint('a', 50, false),
        mint('b', 90, false),
        mint('c', 200, false)
      ],
      selectedMintUrl: 'a'
    })

    expect(route).toStrictEqual({ kind: 'single', mintUrl: 'c' })
  })

  it('does not mix mint urls for ecash send', () => {
    const route = selectMintRoute({
      allowMpp: false,
      amountSats: 70,
      mints: [mint('a', 40, true), mint('b', 40, true)],
      selectedMintUrl: null
    })

    expect(route.kind).toBe('insufficient')
  })

  it('allocates MPP from largest NUT-15 mints', () => {
    const slices = allocateMppSlices(700, [
      mint('small', 400, true),
      mint('big', 500, true),
      mint('no-mpp', 1000, false)
    ])

    expect(slices).toStrictEqual([
      { amountSats: 500, mintUrl: 'big' },
      { amountSats: 200, mintUrl: 'small' }
    ])
  })

  it('skips mints without NUT-15', () => {
    const slices = allocateMppSlices(500, [
      mint('no-mpp', 1000, false),
      mint('mpp', 200, true)
    ])

    expect(slices).toBeNull()
  })

  it('returns insufficient when total is too low', () => {
    const route = selectMintRoute({
      allowMpp: true,
      amountSats: 600,
      mints: [mint('a', 200, true), mint('b', 300, true)],
      selectedMintUrl: null
    })

    expect(route.kind).toBe('insufficient')
  })

  it('returns no_mpp when total covers but MPP is unavailable', () => {
    const route = selectMintRoute({
      allowMpp: true,
      amountSats: 70,
      mints: [mint('a', 40, false), mint('b', 40, false)],
      selectedMintUrl: null
    })

    expect(route.kind).toBe('no_mpp')
  })
})
