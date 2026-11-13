import ElectrumClient from '@/api/electrum'
import {
  assertElectrumReachable,
  ElectrumUnreachableError
} from '@/api/electrumReachability'
import { openServerChainReader } from '@/api/serverChain'
import { type Server } from '@/types/settings/blockchain'

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  default: { initClientFromUrl: jest.fn() }
}))

jest.mock<typeof import('@/api/electrumReachability')>(
  '@/api/electrumReachability',
  () => ({
    ...jest.requireActual<typeof import('@/api/electrumReachability')>(
      '@/api/electrumReachability'
    ),
    assertElectrumReachable: jest.fn()
  })
)

const ELECTRUM_SERVER: Server = {
  backend: 'electrum',
  name: 'Mempool',
  network: 'signet',
  url: 'ssl://mempool.space:60602'
}

describe('openServerChainReader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('gives up on an electrum server that does not answer the ping', async () => {
    jest
      .mocked(assertElectrumReachable)
      .mockRejectedValue(new ElectrumUnreachableError(ELECTRUM_SERVER.url))

    await expect(openServerChainReader(ELECTRUM_SERVER)).rejects.toThrow(
      'unreachable'
    )
    expect(ElectrumClient.initClientFromUrl).not.toHaveBeenCalled()
  })

  it('reads the tip and block hashes from a reachable electrum server', async () => {
    jest.mocked(assertElectrumReachable).mockResolvedValue()
    const close = jest.fn()
    jest.mocked(ElectrumClient.initClientFromUrl).mockResolvedValue({
      close,
      getBlock: jest.fn(() => Promise.resolve({ getId: () => 'f'.repeat(64) })),
      subscribeToBlockHeaders: jest.fn(() =>
        Promise.resolve({ height: 280_000 })
      )
    } as unknown as ElectrumClient)

    const reader = await openServerChainReader(ELECTRUM_SERVER)

    await expect(reader.tipHeight()).resolves.toBe(280_000)
    await expect(reader.blockHash(279_990)).resolves.toBe('f'.repeat(64))
    reader.close()
    expect(close).toHaveBeenCalledTimes(1)
  })
})
