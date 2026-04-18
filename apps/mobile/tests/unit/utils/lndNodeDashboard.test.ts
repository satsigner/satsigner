import { mergeCombinedTransactions } from '@/utils/lndNodeDashboard'

describe('mergeCombinedTransactions', () => {
  it('dedupes by id and sorts newest first', () => {
    const merged = mergeCombinedTransactions([
      {
        amount: 1,
        hash: 'a',
        id: 'dup',
        status: 'confirmed',
        timestamp: 100,
        type: 'onchain'
      },
      {
        amount: 2,
        hash: 'b',
        id: 'dup',
        status: 'confirmed',
        timestamp: 200,
        type: 'onchain'
      },
      {
        amount: 3,
        hash: 'c',
        id: 'c',
        status: 'confirmed',
        timestamp: 150,
        type: 'onchain'
      }
    ])

    expect(merged.map((tx) => tx.id)).toStrictEqual(['dup', 'c'])
    expect(merged[0]?.timestamp).toBe(200)
  })
})
