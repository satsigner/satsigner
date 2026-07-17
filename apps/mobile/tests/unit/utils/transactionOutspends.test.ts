import { type Server } from '@/types/settings/blockchain'
import { fetchTransactionOutspends } from '@/utils/transactionOutspends'

const mockGetTxOutspends = jest.fn()
const mockGetTxOut = jest.fn()
const mockGetAddressUtxos = jest.fn()
const mockClose = jest.fn()
const mockInitClientFromUrl = jest.fn()

jest.mock<typeof import('@/api/esplora')>('@/api/esplora', () =>
  jest.fn(() => ({
    getTxOutspends: mockGetTxOutspends
  }))
)

jest.mock<typeof import('@/api/rpc')>('@/api/rpc', () =>
  jest.fn(() => ({
    getTxOut: mockGetTxOut
  }))
)

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  default: {
    initClientFromUrl: (...args: unknown[]) => mockInitClientFromUrl(...args)
  }
}))

describe('fetchTransactionOutspends', () => {
  beforeEach(() => {
    mockGetTxOutspends.mockReset()
    mockGetTxOut.mockReset()
    mockGetAddressUtxos.mockReset()
    mockClose.mockReset()
    mockInitClientFromUrl.mockReset()
    mockInitClientFromUrl.mockResolvedValue({
      close: mockClose,
      getAddressUtxos: mockGetAddressUtxos
    })
  })

  it('maps Esplora outspends by vout', async () => {
    mockGetTxOutspends.mockResolvedValue([
      { spent: false },
      { spent: true, txid: 'spender' }
    ])

    const server: Server = {
      backend: 'esplora',
      name: 'test',
      network: 'signet',
      url: 'https://example.com'
    }

    const result = await fetchTransactionOutspends(server, 'txid', [
      { address: 'bc1qa', vout: 0 },
      { address: 'bc1qb', vout: 1 }
    ])

    expect(result.get(0)).toStrictEqual({
      spendingTxId: undefined,
      spent: false
    })
    expect(result.get(1)).toStrictEqual({
      spendingTxId: 'spender',
      spent: true
    })
  })

  it('uses RPC gettxout null as spent', async () => {
    mockGetTxOut.mockResolvedValueOnce({ value: 1 }).mockResolvedValueOnce(null)

    const server: Server = {
      backend: 'rpc',
      name: 'test',
      network: 'signet',
      rpcCredentials: { password: 'p', username: 'u' },
      url: 'http://127.0.0.1:38332'
    }

    const result = await fetchTransactionOutspends(server, 'txid', [
      { address: 'bc1qa', vout: 0 },
      { address: 'bc1qb', vout: 1 }
    ])

    expect(result.get(0)).toStrictEqual({ spent: false })
    expect(result.get(1)).toStrictEqual({ spent: true })
  })

  it('uses Electrum listunspent membership for spent status', async () => {
    mockGetAddressUtxos.mockResolvedValue([
      { height: 1, tx_hash: 'txid', tx_pos: 0, value: 100 }
    ])

    const server: Server = {
      backend: 'electrum',
      name: 'test',
      network: 'signet',
      url: 'ssl://example.com:50002'
    }

    const result = await fetchTransactionOutspends(server, 'txid', [
      { address: 'bc1qa', vout: 0 },
      { address: 'bc1qa', vout: 1 }
    ])

    expect(result.get(0)).toStrictEqual({ spent: false })
    expect(result.get(1)).toStrictEqual({ spent: true })
    expect(mockClose).toHaveBeenCalledWith()
  })
})
