import {
  fetchExplorerAddressFromBackend,
  fetchExplorerAddressFromMempool
} from '@/api/explorerAddress'

const mockElectrumClient = {
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
}

const mockFromUrl = jest.fn().mockReturnValue(mockElectrumClient)

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  default: {
    fromUrl: (...args: unknown[]) => mockFromUrl(...args)
  }
}))

const mockGetAddress = jest.fn()
const mockGetAddressTxsPage = jest.fn()
const mockGetAddressUtxos = jest.fn()

jest.mock<typeof import('@/api/esplora')>('@/api/esplora', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    getAddress: (...args: unknown[]) => mockGetAddress(...args),
    getAddressTxsPage: (...args: unknown[]) => mockGetAddressTxsPage(...args),
    getAddressUtxos: (...args: unknown[]) => mockGetAddressUtxos(...args)
  })
}))

describe('fetchExplorerAddressFromBackend', () => {
  beforeEach(() => {
    mockFromUrl.mockReset().mockReturnValue(mockElectrumClient)
    mockElectrumClient.close.mockReset()
    mockElectrumClient.init.mockReset().mockResolvedValue(undefined)
    mockElectrumClient.getAddressBalance.mockReset().mockResolvedValue({
      confirmed: 1000,
      unconfirmed: 50
    })
    mockElectrumClient.getAddressTransactions
      .mockReset()
      .mockResolvedValue([{ tx_hash: 'aa'.repeat(32) }])
    mockElectrumClient.getAddressUtxos.mockReset().mockResolvedValue([
      {
        height: 100,
        tx_hash: 'aa'.repeat(32),
        tx_pos: 0,
        value: 1000
      }
    ])
    mockGetAddress.mockReset().mockResolvedValue({
      chain_stats: { funded_txo_sum: 2000, spent_txo_sum: 0 },
      mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 }
    })
    mockGetAddressTxsPage
      .mockReset()
      .mockResolvedValue([{ txid: 'bb'.repeat(32) }])
    mockGetAddressUtxos.mockReset().mockResolvedValue([
      {
        status: { block_height: 200, confirmed: true },
        txid: 'bb'.repeat(32),
        value: 2000,
        vout: 1
      }
    ])
  })

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

  it('loads esplora address data from summary and first tx page', async () => {
    const result = await fetchExplorerAddressFromBackend(
      'bc1qtest',
      'https://esplora.example',
      'esplora',
      'bitcoin'
    )
    expect(result.source).toBe('backend')
    expect(result.confirmed).toBe(2000)
    expect(result.txids[0]).toBe('bb'.repeat(32))
    expect(result.utxos[0]?.value).toBe(2000)
  })

  it('keeps balance when utxo list is rejected', async () => {
    mockGetAddressUtxos.mockRejectedValueOnce(new Error('HTTP 400'))

    const result = await fetchExplorerAddressFromBackend(
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      'https://esplora.example',
      'esplora',
      'bitcoin'
    )
    expect(result.confirmed).toBe(2000)
    expect(result.utxos).toStrictEqual([])
    expect(result.txids).toHaveLength(1)
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
  beforeEach(() => {
    mockGetAddress.mockReset().mockResolvedValue({
      chain_stats: { funded_txo_sum: 5000, spent_txo_sum: 2000 },
      mempool_stats: { funded_txo_sum: 100, spent_txo_sum: 0 }
    })
    mockGetAddressTxsPage
      .mockReset()
      .mockResolvedValue([{ txid: 'cc'.repeat(32) }])
    mockGetAddressUtxos.mockReset().mockResolvedValue([
      {
        status: { block_height: 300, confirmed: true },
        txid: 'cc'.repeat(32),
        value: 3000,
        vout: 0
      }
    ])
  })

  it('maps balances, utxos and txids from mempool api', async () => {
    const result = await fetchExplorerAddressFromMempool('bc1qtest', {
      baseUrl: 'https://mempool.space/api'
    })
    expect(result.source).toBe('mempool')
    expect(result.confirmed).toBe(3000)
    expect(result.unconfirmed).toBe(100)
    expect(result.txids).toStrictEqual(['cc'.repeat(32)])
    expect(result.utxos[0]?.value).toBe(3000)
  })

  it('succeeds when utxo endpoint hits the 500-utxo limit', async () => {
    mockGetAddressUtxos.mockRejectedValueOnce(
      new Error('Too many unspent transaction outputs')
    )

    const result = await fetchExplorerAddressFromMempool(
      '1BitcoinEaterAddressDontSendf59kuE',
      { baseUrl: 'https://mempool.space/api' }
    )
    expect(result.source).toBe('mempool')
    expect(result.confirmed).toBe(3000)
    expect(result.utxos).toStrictEqual([])
    expect(result.txids).toStrictEqual(['cc'.repeat(32)])
  })
})
