import { broadcastRawTransaction } from '@/api/broadcast'

const mockElectrumClient = {
  broadcastTransactionHex: jest.fn(),
  close: jest.fn()
}

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  default: { initClientFromUrl: jest.fn(() => mockElectrumClient) }
}))

const ELECTRUM_SERVER = {
  backend: 'electrum' as const,
  url: 'ssl://electrum.example:50002'
}

describe('broadcastRawTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('closes the Electrum client after a broadcast', async () => {
    mockElectrumClient.broadcastTransactionHex.mockResolvedValue('txid')
    await expect(
      broadcastRawTransaction('00', ELECTRUM_SERVER, 'signet')
    ).resolves.toBe('txid')
    expect(mockElectrumClient.close).toHaveBeenCalledTimes(1)
  })

  it('closes the Electrum client when the server rejects the transaction', async () => {
    mockElectrumClient.broadcastTransactionHex.mockRejectedValue(
      new Error('txn-mempool-conflict')
    )
    await expect(
      broadcastRawTransaction('00', ELECTRUM_SERVER, 'signet')
    ).rejects.toThrow('txn-mempool-conflict')
    expect(mockElectrumClient.close).toHaveBeenCalledTimes(1)
  })
})
