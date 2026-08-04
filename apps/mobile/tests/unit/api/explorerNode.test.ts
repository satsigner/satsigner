import {
  fetchBitnodesNetworkStats,
  fetchBitnodesNodeInfo
} from '@/api/explorerNode'

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  closeElectrumClientQuietly: jest.fn(),
  default: { fromUrl: jest.fn() }
}))

jest.mock<typeof import('@/api/rpc')>('@/api/rpc', () => ({
  __esModule: true,
  default: jest.fn()
}))

function mockFetchOnce(body: unknown, ok = true) {
  jest.mocked(global.fetch).mockResolvedValueOnce({
    json: () => Promise.resolve(body),
    ok
  })
}

describe('explorerNode api', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  describe('fetchBitnodesNodeInfo', () => {
    it('skips the lookup and returns null on non-mainnet networks', async () => {
      const result = await fetchBitnodesNodeInfo(
        'ssl://node.example:50002',
        'signet'
      )
      expect(result).toBeNull()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('derives the port from the server url on mainnet', async () => {
      mockFetchOnce({ height: 800_000, last_seen: 123, user_agent: '/core/' })

      const result = await fetchBitnodesNodeInfo(
        'tcp://node.example:8444',
        'bitcoin'
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://bitnodes.io/api/v1/nodes/node.example-8444/'
      )
      expect(result?.height).toBe(800_000)
    })

    it('defaults to the mainnet p2p port when the url omits one', async () => {
      mockFetchOnce({ height: 1, last_seen: 2, user_agent: '/core/' })

      await fetchBitnodesNodeInfo('ssl://node.example', 'bitcoin')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://bitnodes.io/api/v1/nodes/node.example-8333/'
      )
    })

    it('returns null when the node endpoint is not ok', async () => {
      mockFetchOnce({}, false)
      const result = await fetchBitnodesNodeInfo('node.example', 'bitcoin')
      expect(result).toBeNull()
    })
  })

  describe('fetchBitnodesNetworkStats', () => {
    it('returns empty stats when the snapshot response is not ok', async () => {
      mockFetchOnce({}, false)
      const result = await fetchBitnodesNetworkStats()
      expect(result).toStrictEqual({
        countryDistribution: [],
        totalNodes: 0,
        versionDistribution: []
      })
    })

    it('returns empty stats when the nodes payload is malformed', async () => {
      mockFetchOnce({
        results: [{ total_nodes: 5, url: 'https://bitnodes.io/api/v1/snap/1/' }]
      })
      mockFetchOnce({ nodes: null, total_nodes: 5 })

      const result = await fetchBitnodesNetworkStats()
      expect(result.totalNodes).toBe(5)
      expect(result.versionDistribution).toStrictEqual([])
      expect(result.countryDistribution).toStrictEqual([])
    })

    it('aggregates version and country distributions', async () => {
      mockFetchOnce({
        results: [{ total_nodes: 2, url: 'https://bitnodes.io/api/v1/snap/1/' }]
      })
      mockFetchOnce({
        nodes: {
          'a:8333': [70_016, '/Satoshi:25.0.0/', '', '', '', '', '', 'US'],
          'b:8333': [70_016, '/Satoshi:25.0.0/', '', '', '', '', '', 'DE']
        },
        total_nodes: 2
      })

      const result = await fetchBitnodesNetworkStats()
      expect(result.totalNodes).toBe(2)
      expect(result.versionDistribution[0]).toStrictEqual({
        count: 2,
        version: 'Satoshi'
      })
      expect(result.countryDistribution).toHaveLength(2)
    })
  })
})
