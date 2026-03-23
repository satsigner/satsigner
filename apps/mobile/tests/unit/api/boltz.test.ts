import {
  BoltzApi,
  BOLTZ_CLEARNET_URL,
  BOLTZ_ONION_URL,
  type BoltzPairs
} from '@/api/boltz'

const mockPairInfo = {
  hash: 'abc123',
  rate: 1,
  limits: { maximalZeroConfAmount: 100000, minimal: 1000, maximal: 25000000 },
  fees: {
    percentage: 0.1,
    minerFees: { normal: 330, reverse: { claim: 276, lockup: 330 } }
  }
}

const mockPairs: BoltzPairs = { BTC: { BTC: mockPairInfo } }

function mockOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body))
  } as Response)
}

function mockError(status: number, message: string) {
  return Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve(message)
  } as Response)
}

describe('BoltzApi', () => {
  let api: BoltzApi
  let fetchMock: jest.Mock

  beforeEach(() => {
    api = new BoltzApi()
    fetchMock = jest.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('URL configuration', () => {
    it('starts with clearnet URL', () => {
      expect(api.baseUrl).toBe(BOLTZ_CLEARNET_URL)
    })

    it('can be switched to onion URL', () => {
      api.baseUrl = BOLTZ_ONION_URL
      expect(api.baseUrl).toBe(BOLTZ_ONION_URL)
    })

    it('derives wss:// WebSocket URL from https:// base URL', () => {
      api.baseUrl = BOLTZ_CLEARNET_URL
      fetchMock.mockReturnValue(mockOk(mockPairs))
      // WebSocket URL is tested indirectly via subscribeToSwap
      const MockWS = jest.fn()
      MockWS.prototype.onopen = null
      MockWS.prototype.close = jest.fn()
      global.WebSocket = MockWS as unknown as typeof WebSocket

      api.subscribeToSwap('test-id', jest.fn())

      expect(MockWS).toHaveBeenCalledWith(
        BOLTZ_CLEARNET_URL.replace('https://', 'wss://') + '/v2/ws'
      )
    })

    it('derives ws:// WebSocket URL from http:// onion base URL', () => {
      api.baseUrl = BOLTZ_ONION_URL
      const MockWS = jest.fn()
      MockWS.prototype.onopen = null
      MockWS.prototype.close = jest.fn()
      global.WebSocket = MockWS as unknown as typeof WebSocket

      api.subscribeToSwap('test-id', jest.fn())

      expect(MockWS).toHaveBeenCalledWith(
        BOLTZ_ONION_URL.replace('http://', 'ws://') + '/v2/ws'
      )
    })

    it('clearnet and onion constants are distinct', () => {
      expect(BOLTZ_CLEARNET_URL).not.toBe(BOLTZ_ONION_URL)
      expect(BOLTZ_CLEARNET_URL).toContain('https')
      expect(BOLTZ_ONION_URL).toContain('.onion')
    })
  })

  describe('getSubmarinePairs', () => {
    it('returns pairs from /v2/swap/submarine', async () => {
      fetchMock.mockReturnValue(mockOk(mockPairs))

      const result = await api.getSubmarinePairs()

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/v2/swap/submarine'),
        expect.objectContaining({ method: 'GET' })
      )
      expect(result).toEqual(mockPairs)
    })

    it('includes minimal and maximal limits', async () => {
      fetchMock.mockReturnValue(mockOk(mockPairs))

      const result = await api.getSubmarinePairs()

      expect(result.BTC.BTC.limits.minimal).toBe(1000)
      expect(result.BTC.BTC.limits.maximal).toBe(25000000)
    })
  })

  describe('createSubmarineSwap', () => {
    it('POSTs to /v2/swap/submarine with params', async () => {
      const mockResponse = {
        id: 'swap-abc',
        address: 'bc1qxxx',
        expectedAmount: 10330,
        swapTree: {
          claimLeaf: { version: 192, output: 'deadbeef' },
          refundLeaf: { version: 192, output: 'cafebabe' }
        },
        claimPublicKey: '02aabbcc'
      }
      fetchMock.mockReturnValue(mockOk(mockResponse))

      const params = {
        invoice: 'lnbc100u1...',
        from: 'BTC' as const,
        to: 'BTC' as const,
        refundPublicKey: '02ddeeff'
      }

      const result = await api.createSubmarineSwap(params)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/v2/swap/submarine'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(params)
        })
      )
      expect(result.id).toBe('swap-abc')
      expect(result.address).toBe('bc1qxxx')
      expect(result.expectedAmount).toBe(10330)
    })
  })

  describe('getSubmarineSwap', () => {
    it('GETs status for a swap ID', async () => {
      const mockStatus = { status: 'transaction.mempool' }
      fetchMock.mockReturnValue(mockOk(mockStatus))

      const result = await api.getSubmarineSwap('swap-abc')

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/v2/swap/submarine/swap-abc'),
        expect.objectContaining({ method: 'GET' })
      )
      expect(result.status).toBe('transaction.mempool')
    })
  })

  describe('getReversePairs', () => {
    it('returns pairs from /v2/swap/reverse', async () => {
      fetchMock.mockReturnValue(mockOk(mockPairs))

      const result = await api.getReversePairs()

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/v2/swap/reverse'),
        expect.objectContaining({ method: 'GET' })
      )
      expect(result.BTC.BTC.fees.minerFees.reverse.claim).toBe(276)
    })
  })

  describe('createReverseSwap', () => {
    it('POSTs to /v2/swap/reverse with params', async () => {
      const mockResponse = {
        id: 'rev-xyz',
        invoice: 'lnbc500u1...',
        lockupAddress: 'bc1qyyy',
        onchainAmount: 49724,
        swapTree: {
          claimLeaf: { version: 192, output: 'aabbccdd' },
          refundLeaf: { version: 192, output: 'eeff0011' }
        },
        refundPublicKey: '0311aabb',
        timeoutBlockHeight: 840000
      }
      fetchMock.mockReturnValue(mockOk(mockResponse))

      const params = {
        invoiceAmount: 50000,
        from: 'BTC' as const,
        to: 'BTC' as const,
        claimPublicKey: '0299ccdd',
        preimageHash: 'deadbeef1234'
      }

      const result = await api.createReverseSwap(params)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/v2/swap/reverse'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(params)
        })
      )
      expect(result.id).toBe('rev-xyz')
      expect(result.invoice).toBe('lnbc500u1...')
      expect(result.lockupAddress).toBe('bc1qyyy')
    })
  })

  describe('getReverseSwap', () => {
    it('GETs status for a reverse swap ID', async () => {
      const mockStatus = {
        status: 'transaction.claimed',
        transaction: { id: 'txabc', hex: '02000000...' }
      }
      fetchMock.mockReturnValue(mockOk(mockStatus))

      const result = await api.getReverseSwap('rev-xyz')

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/v2/swap/reverse/rev-xyz'),
        expect.objectContaining({ method: 'GET' })
      )
      expect(result.status).toBe('transaction.claimed')
      expect(result.transaction?.id).toBe('txabc')
    })
  })

  describe('error handling', () => {
    it('throws on non-ok HTTP response', async () => {
      fetchMock.mockReturnValue(mockError(400, 'invalid invoice'))

      await expect(api.getSubmarinePairs()).rejects.toThrow('400')
    })

    it('includes server message in error', async () => {
      fetchMock.mockReturnValue(mockError(500, 'internal server error'))

      await expect(api.getSubmarinePairs()).rejects.toThrow(
        'internal server error'
      )
    })

    it('throws on network failure', async () => {
      fetchMock.mockRejectedValue(new Error('Network request failed'))

      await expect(api.getSubmarinePairs()).rejects.toThrow(
        'Network request failed'
      )
    })

    it('uses configured baseUrl in requests', async () => {
      api.baseUrl = BOLTZ_ONION_URL
      fetchMock.mockReturnValue(mockOk(mockPairs))

      await api.getSubmarinePairs()

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(BOLTZ_ONION_URL),
        expect.any(Object)
      )
    })
  })

  describe('subscribeToSwap', () => {
    let MockWS: jest.Mock
    let wsInstance: {
      onopen: (() => void) | null
      onmessage: ((e: { data: string }) => void) | null
      send: jest.Mock
      close: jest.Mock
    }

    beforeEach(() => {
      wsInstance = {
        onopen: null,
        onmessage: null,
        send: jest.fn(),
        close: jest.fn()
      }
      MockWS = jest.fn(() => wsInstance)
      global.WebSocket = MockWS as unknown as typeof WebSocket
    })

    it('opens WebSocket to /v2/ws', () => {
      api.subscribeToSwap('swap-1', jest.fn())

      expect(MockWS).toHaveBeenCalledWith(expect.stringContaining('/v2/ws'))
    })

    it('sends subscribe message on open', () => {
      api.subscribeToSwap('swap-1', jest.fn())
      wsInstance.onopen!()

      expect(wsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          op: 'subscribe',
          channel: 'swap.update',
          args: ['swap-1']
        })
      )
    })

    it('calls onUpdate when matching swap status arrives', () => {
      const onUpdate = jest.fn()
      api.subscribeToSwap('swap-1', onUpdate)

      wsInstance.onmessage!({
        data: JSON.stringify({
          channel: 'swap.update',
          args: [{ id: 'swap-1', status: 'transaction.mempool' }]
        })
      })

      expect(onUpdate).toHaveBeenCalledWith('transaction.mempool')
    })

    it('ignores messages for a different swap ID', () => {
      const onUpdate = jest.fn()
      api.subscribeToSwap('swap-1', onUpdate)

      wsInstance.onmessage!({
        data: JSON.stringify({
          channel: 'swap.update',
          args: [{ id: 'swap-OTHER', status: 'transaction.mempool' }]
        })
      })

      expect(onUpdate).not.toHaveBeenCalled()
    })

    it('ignores messages on other channels', () => {
      const onUpdate = jest.fn()
      api.subscribeToSwap('swap-1', onUpdate)

      wsInstance.onmessage!({
        data: JSON.stringify({
          channel: 'other.channel',
          args: [{ id: 'swap-1', status: 'transaction.mempool' }]
        })
      })

      expect(onUpdate).not.toHaveBeenCalled()
    })

    it('ignores malformed messages without throwing', () => {
      api.subscribeToSwap('swap-1', jest.fn())

      expect(() => {
        wsInstance.onmessage!({ data: 'not json {{{' })
      }).not.toThrow()
    })

    it('returns an unsubscribe function that closes the WebSocket', () => {
      const unsubscribe = api.subscribeToSwap('swap-1', jest.fn())
      unsubscribe()

      expect(wsInstance.close).toHaveBeenCalled()
    })
  })
})
