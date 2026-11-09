import { broadcastRawTransaction } from '@/api/broadcast'

const mockElectrumClient = {
  broadcastTransactionHex: jest.fn(),
  close: jest.fn()
}

const mockEsploraBroadcast = jest.fn()
const mockRpcSend = jest.fn()

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  default: { initClientFromUrl: jest.fn(() => mockElectrumClient) }
}))

jest.mock<typeof import('@/api/esplora')>('@/api/esplora', () => ({
  __esModule: true,
  default: jest.fn((url: string) => ({
    broadcastTransaction: (txHex: string) => mockEsploraBroadcast(url, txHex)
  }))
}))

jest.mock<typeof import('@/api/rpc')>('@/api/rpc', () => ({
  __esModule: true,
  default: jest.fn((url: string, username: string, password: string) => ({
    sendRawTransaction: (txHex: string) =>
      mockRpcSend({ password, txHex, url, username })
  }))
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

  it('closes the Electrum client only once the broadcast settles', async () => {
    const pending: { resolve: (txid: string) => void } = {
      resolve: () => undefined
    }
    mockElectrumClient.broadcastTransactionHex.mockReturnValue(
      new Promise<string>((resolve) => {
        pending.resolve = resolve
      })
    )
    const broadcast = broadcastRawTransaction('00', ELECTRUM_SERVER, 'signet')
    await Promise.resolve()
    await Promise.resolve()
    expect(mockElectrumClient.broadcastTransactionHex).toHaveBeenCalledWith(
      '00'
    )
    expect(mockElectrumClient.close).not.toHaveBeenCalled()

    pending.resolve('txid')
    await expect(broadcast).resolves.toBe('txid')
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

  it('sends to the Esplora URL', async () => {
    mockEsploraBroadcast.mockResolvedValue('esplora-txid')
    await expect(
      broadcastRawTransaction('00', {
        backend: 'esplora',
        url: 'https://esplora.example'
      })
    ).resolves.toBe('esplora-txid')
    expect(mockEsploraBroadcast).toHaveBeenCalledWith(
      'https://esplora.example',
      '00'
    )
  })

  it('sends to the RPC node with its stored credentials', async () => {
    mockRpcSend.mockResolvedValue('rpc-txid')
    await expect(
      broadcastRawTransaction('00', {
        backend: 'rpc',
        rpcCredentials: { password: 'secret', username: 'user' },
        url: 'http://node.example:8332'
      })
    ).resolves.toBe('rpc-txid')
    expect(mockRpcSend).toHaveBeenCalledWith({
      password: 'secret',
      txHex: '00',
      url: 'http://node.example:8332',
      username: 'user'
    })
  })

  it('passes on a node rejection', async () => {
    mockRpcSend.mockRejectedValue(new Error('bad-txns-inputs-missingorspent'))
    await expect(
      broadcastRawTransaction('00', {
        backend: 'rpc',
        url: 'http://node.example:8332'
      })
    ).rejects.toThrow('bad-txns-inputs-missingorspent')
  })

  it('refuses an unknown backend instead of treating it as Esplora', async () => {
    const server = JSON.parse(
      '{"backend":"unknown","url":"https://esplora.example"}'
    )
    await expect(broadcastRawTransaction('00', server)).rejects.toThrow(
      'Unsupported backend: unknown'
    )
    expect(mockEsploraBroadcast).not.toHaveBeenCalled()
  })
})
