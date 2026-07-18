import {
  fetchExplorerAddressFromBackend,
  fetchExplorerAddressFromMempool
} from '@/api/explorerAddress'

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  default: {
    fromUrl: jest.fn().mockReturnValue({
      close: jest.fn(),
      getAddressBalance: jest.fn().mockResolvedValue({
        confirmed: 1000,
        unconfirmed: 50
      }),
      getAddressTransactions: jest
        .fn()
        .mockResolvedValue([{ tx_hash: 'aa'.repeat(32) }]),
      getAddressUtxos: jest.fn().mockResolvedValue([
        {
          height: 100,
          tx_hash: 'aa'.repeat(32),
          tx_pos: 0,
          value: 1000
        }
      ]),
      init: jest.fn().mockResolvedValue(undefined)
    })
  }
}))

jest.mock<typeof import('@/api/esplora')>('@/api/esplora', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    getAddressTxs: jest.fn().mockResolvedValue([{ txid: 'bb'.repeat(32) }]),
    getAddressUtxos: jest.fn().mockResolvedValue([
      {
        status: { block_height: 200, confirmed: true },
        txid: 'bb'.repeat(32),
        value: 2000,
        vout: 1
      }
    ])
  })
}))

describe('fetchExplorerAddressFromBackend', () => {
  it('loads electrum address data', async () => {
    const result = await fetchExplorerAddressFromBackend(
      'bc1qtest',
      'ssl://electrum.example:50002',
      'electrum',
      'bitcoin'
    )
    expect(result.source).toBe('backend')
    expect(result.confirmed).toBe(1000)
    expect(result.unconfirmed).toBe(50)
    expect(result.txids).toHaveLength(1)
    expect(result.utxos[0]?.value).toBe(1000)
  })

  it('loads esplora address data', async () => {
    const result = await fetchExplorerAddressFromBackend(
      'bc1qtest',
      'https://esplora.example',
      'esplora',
      'bitcoin'
    )
    expect(result.source).toBe('backend')
    expect(result.confirmed).toBe(2000)
    expect(result.txids[0]).toBe('bb'.repeat(32))
  })

  it('rejects rpc without wallet index', async () => {
    await expect(
      fetchExplorerAddressFromBackend(
        'bc1qtest',
        'http://127.0.0.1:8332',
        'rpc',
        'bitcoin'
      )
    ).rejects.toThrow('rpc_unsupported')
  })
})

describe('fetchExplorerAddressFromMempool', () => {
  it('maps utxos and txids from oracle', async () => {
    const oracle = {
      get: jest.fn().mockResolvedValue([{ txid: 'cc'.repeat(32) }]),
      getAddressUtxos: jest.fn().mockResolvedValue([
        {
          status: { block_height: 300, confirmed: true },
          txid: 'cc'.repeat(32),
          value: 3000,
          vout: 0
        }
      ])
    }

    const result = await fetchExplorerAddressFromMempool('bc1qtest', oracle)
    expect(result.source).toBe('mempool')
    expect(result.confirmed).toBe(3000)
    expect(result.txids).toStrictEqual(['cc'.repeat(32)])
  })
})
