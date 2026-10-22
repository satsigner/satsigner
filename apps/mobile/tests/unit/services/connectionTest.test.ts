import ElectrumClient, { closeElectrumClientQuietly } from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import { CONNECTION_TEST_TIMEOUT_MS } from '@/constants/connectionTest'
import {
  probeConnection,
  toConnectionTestFailure
} from '@/services/connectionTest'

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  closeElectrumClientQuietly: jest.fn(),
  default: { fromUrl: jest.fn() }
}))

jest.mock<typeof import('@/api/rpc')>('@/api/rpc', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock<typeof import('@/api/esplora')>('@/api/esplora', () => ({
  __esModule: true,
  default: jest.fn()
}))

const RPC_URL = 'http://node.local:38332'
const ELECTRUM_URL = 'ssl://electrum.local:60002'
const TOR_PROXY = { enabled: true, host: '127.0.0.1', port: 9050 }

function mockElectrum(init: jest.Mock) {
  const client = {
    getBlockTimestamp: jest.fn(),
    getServerBanner: jest.fn().mockRejectedValue(new Error('unsupported')),
    init,
    subscribeToBlockHeaders: jest
      .fn()
      .mockRejectedValue(new Error('unsupported'))
  }
  jest.mocked(ElectrumClient.fromUrl).mockReturnValue(client)
  return client
}

function mockRpc(chain: string) {
  jest.mocked(BitcoinRpc).mockReturnValue({
    getBlockchainInfo: jest.fn().mockResolvedValue({
      blocks: 200_000,
      chain,
      chainwork: 'abc',
      mediantime: 1_700_000_000
    }),
    getNetworkInfo: jest.fn().mockRejectedValue(new Error('no info')),
    hasBlockFilterIndex: jest.fn().mockResolvedValue(true)
  })
}

describe('probeConnection', () => {
  afterEach(() => {
    jest.useRealTimers()
    jest.resetAllMocks()
  })

  it('reports the tip of a Core node on the expected chain', async () => {
    mockRpc('signet')

    const result = await probeConnection({
      backend: 'rpc',
      network: 'signet',
      url: RPC_URL
    })

    expect(result).toStrictEqual({
      banner: undefined,
      blockFilterIndexMissing: false,
      blockHeight: 200_000,
      success: true,
      tipTimestampSec: 1_700_000_000
    })
  })

  it('rejects a Core node on the wrong chain', async () => {
    mockRpc('main')

    await expect(
      probeConnection({ backend: 'rpc', network: 'signet', url: RPC_URL })
    ).rejects.toThrow(RPC_URL)
  })

  it('still succeeds when the esplora tip timestamp is unavailable', async () => {
    jest.mocked(Esplora).mockReturnValue({
      getBlockAtHeight: jest.fn().mockRejectedValue(new Error('404')),
      getLatestBlockHeight: jest.fn().mockResolvedValue(100)
    })

    const result = await probeConnection({
      backend: 'esplora',
      network: 'signet',
      url: 'https://mempool.space/signet/api'
    })

    expect(result).toStrictEqual({
      blockHeight: 100,
      success: true,
      tipTimestampSec: undefined
    })
  })

  it('closes the Electrum client when optional calls fail', async () => {
    const client = mockElectrum(jest.fn().mockResolvedValue(undefined))

    const result = await probeConnection({
      backend: 'electrum',
      network: 'signet',
      url: ELECTRUM_URL
    })

    expect(closeElectrumClientQuietly).toHaveBeenCalledWith(client)
    expect(result).toStrictEqual({
      banner: undefined,
      blockHeight: undefined,
      success: true,
      tipTimestampSec: undefined
    })
  })

  it('rejects when the Electrum handshake fails', async () => {
    mockElectrum(jest.fn().mockRejectedValue(new Error('connection refused')))

    await expect(
      probeConnection({
        backend: 'electrum',
        network: 'signet',
        url: ELECTRUM_URL
      })
    ).rejects.toThrow('connection refused')
    expect(closeElectrumClientQuietly).toHaveBeenCalledTimes(1)
  })

  it('rejects and closes the Electrum client when the server does not answer in time', async () => {
    jest.useFakeTimers()
    const client = mockElectrum(
      jest.fn().mockReturnValue(new Promise(() => {}))
    )

    const probe = probeConnection({
      backend: 'electrum',
      network: 'signet',
      url: ELECTRUM_URL
    })
    jest.advanceTimersByTime(CONNECTION_TEST_TIMEOUT_MS)

    await expect(probe).rejects.toThrow('Connection test timeout')
    expect(closeElectrumClientQuietly).toHaveBeenCalledWith(client)
  })

  it('passes through the Electrum tip, its timestamp and a trimmed banner', async () => {
    const client = mockElectrum(jest.fn().mockResolvedValue(undefined))
    client.subscribeToBlockHeaders.mockResolvedValue({ height: 10 })
    client.getServerBanner.mockResolvedValue('  hi  ')
    client.getBlockTimestamp.mockResolvedValue(1_700_000_000)

    const result = await probeConnection({
      backend: 'electrum',
      network: 'signet',
      url: ELECTRUM_URL
    })

    expect(client.getBlockTimestamp).toHaveBeenCalledWith(10)
    expect(result).toStrictEqual({
      banner: 'hi',
      blockHeight: 10,
      success: true,
      tipTimestampSec: 1_700_000_000
    })
  })
})

describe('toConnectionTestFailure', () => {
  it('surfaces the message of a thrown Error', () => {
    expect(
      toConnectionTestFailure(new Error('connection refused'), TOR_PROXY)
    ).toStrictEqual({ error: 'connection refused', success: false })
  })

  it('points at Tor when a proxied probe fails without an Error', () => {
    expect(toConnectionTestFailure('socket closed', TOR_PROXY)).toStrictEqual({
      error: 'Proxy connection failed. Ensure Tor/Orbot is running.',
      success: false
    })
  })

  it('falls back to a generic message without a proxy', () => {
    expect(toConnectionTestFailure('socket closed')).toStrictEqual({
      error: 'Unknown connection error',
      success: false
    })
  })
})
