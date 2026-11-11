import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { fetchChainData } from '@/api/explorerChain'

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  closeElectrumClientQuietly: jest.fn(),
  default: { fromUrl: jest.fn() }
}))

jest.mock<typeof import('@/api/esplora')>('@/api/esplora', () => ({
  __esModule: true,
  default: jest.fn()
}))

const ESPLORA_URL = 'https://esplora.example.com/api'
const ELECTRUM_URL = 'ssl://electrum.example.com:50002'

describe('fetchChainData', () => {
  it('reads the tip from esplora', async () => {
    jest.mocked(Esplora).mockReturnValue({
      getBlockInfo: jest.fn().mockResolvedValue({
        difficulty: 2,
        timestamp: 1_700_000_000
      }),
      getLatestBlockHash: jest.fn().mockResolvedValue('tiphash'),
      getLatestBlockHeight: jest.fn().mockResolvedValue(280_000)
    } as unknown as Esplora)

    await expect(
      fetchChainData({ backend: 'esplora', url: ESPLORA_URL }, 'signet')
    ).resolves.toStrictEqual({
      difficulty: 2,
      hash: 'tiphash',
      height: 280_000,
      source: 'backend',
      timestamp: 1_700_000_000
    })
  })

  it('fails when esplora is unreachable', async () => {
    jest.mocked(Esplora).mockReturnValue({
      getLatestBlockHash: jest.fn().mockRejectedValue(new Error('offline')),
      getLatestBlockHeight: jest.fn().mockRejectedValue(new Error('offline'))
    } as unknown as Esplora)

    await expect(
      fetchChainData({ backend: 'esplora', url: ESPLORA_URL }, 'signet')
    ).rejects.toThrow('offline')
  })

  it('fails when the electrum server is unreachable', async () => {
    jest.mocked(ElectrumClient.fromUrl).mockReturnValue({
      init: jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    } as unknown as ElectrumClient)

    await expect(
      fetchChainData({ backend: 'electrum', url: ELECTRUM_URL }, 'signet')
    ).rejects.toThrow('ECONNREFUSED')
  })
})
