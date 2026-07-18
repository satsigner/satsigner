import { fetchExplorerBlockVizFromMempool } from '@/api/explorerBlockViz'

describe('fetchExplorerBlockVizFromMempool', () => {
  it('maps extras and sample fee rates from mempool responses', async () => {
    const oracle = {
      get: jest.fn().mockResolvedValue([
        {
          extras: {
            avgFee: 1000,
            avgFeeRate: 4,
            avgTxSize: 250,
            feeRange: [1, 2, 3, 4, 5, 6, 10],
            matchRate: 98,
            medianFee: 3,
            pool: { id: 1, name: 'ExamplePool', slug: 'example' },
            reward: 312500000,
            segwitTotalTxs: 8,
            totalFees: 50000,
            totalInputs: 20,
            totalOutputs: 22,
            virtualSize: 900000
          },
          height: 100,
          id: 'ab'.repeat(32),
          tx_count: 10
        }
      ]),
      getBlockTransactions: jest.fn().mockResolvedValue([
        {
          fee: 400,
          txid: 'cd'.repeat(32),
          weight: 400
        },
        {
          fee: 800,
          txid: 'ef'.repeat(32),
          weight: 800
        }
      ])
    }

    const result = await fetchExplorerBlockVizFromMempool(100, oracle)

    expect(result.source).toBe('mempool')
    expect(result.height).toBe(100)
    expect(result.extras.pool?.name).toBe('ExamplePool')
    expect(result.extras.feeRange).toHaveLength(7)
    expect(result.extras.totalFees).toBe(50000)
    expect(result.sampleTxs).toHaveLength(2)
    expect(result.sampleTxs[0]?.feeRate).toBe(4)
    expect(result.sampleTxs[1]?.feeRate).toBe(4)
  })

  it('throws when no block matches', async () => {
    const oracle = {
      get: jest.fn().mockResolvedValue([]),
      getBlockTransactions: jest.fn()
    }

    await expect(fetchExplorerBlockVizFromMempool(1, oracle)).rejects.toThrow(
      'block_viz_not_found'
    )
  })
})
