import { Platform } from 'react-native'

import BitcoinRpc, {
  adjustRpcUrl,
  BitcoinCoreWallet,
  RPC_DEFAULT_TIMEOUT_MS
} from '@/api/rpc'

jest.mock<typeof import('react-native')>('react-native', () => ({
  Platform: { OS: 'ios' }
}))

const NODE_URL = 'http://127.0.0.1:8332'
const USER = 'rpcuser'
const PASS = 'rpcpass'

function jsonResponse<T>(body: T, status = 200): Response {
  return {
    json: () => Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response
}

function rpcResult<T>(result: T): Response {
  return jsonResponse({ error: null, id: 'x', result })
}

function rpcError(code: number, message: string): Response {
  return jsonResponse({ error: { code, message }, id: 'x', result: null })
}

describe('adjustRpcUrl', () => {
  afterEach(() => {
    Platform.OS = 'ios'
  })

  it('leaves the URL untouched on iOS', () => {
    Platform.OS = 'ios'
    expect(adjustRpcUrl('http://127.0.0.1:8332')).toBe('http://127.0.0.1:8332')
  })

  it('remaps localhost to the Android emulator host alias', () => {
    Platform.OS = 'android'
    expect(adjustRpcUrl('http://localhost:8332')).toBe('http://10.0.2.2:8332/')
  })

  it('remaps 127.0.0.1 to the Android emulator host alias', () => {
    Platform.OS = 'android'
    expect(adjustRpcUrl('http://127.0.0.1:8332/')).toBe('http://10.0.2.2:8332/')
  })

  it('leaves Docker bridge addresses untouched on Android', () => {
    Platform.OS = 'android'
    expect(adjustRpcUrl('http://172.17.0.2:8332')).toBe(
      'http://172.17.0.2:8332'
    )
  })

  it('leaves other LAN addresses untouched on Android', () => {
    Platform.OS = 'android'
    expect(adjustRpcUrl('http://192.168.1.50:8332')).toBe(
      'http://192.168.1.50:8332'
    )
  })

  it('falls back to the original string for unparsable input', () => {
    Platform.OS = 'android'
    expect(adjustRpcUrl('not-a-url')).toBe('not-a-url')
  })
})

describe('bitcoinRpc', () => {
  let mockFetch: jest.Mock

  beforeEach(() => {
    mockFetch = jest.fn()
    global.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('sends a well-formed JSON-RPC request with Basic Auth', async () => {
    mockFetch.mockResolvedValueOnce(rpcResult(42))
    const rpc = new BitcoinRpc(NODE_URL, USER, PASS)

    const result = await rpc.getBlockCount()

    expect(result).toBe(42)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [[url, init]] = mockFetch.mock.calls
    expect(url).toBe(NODE_URL)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.headers['Authorization']).toBe(
      `Basic ${btoa(`${USER}:${PASS}`)}`
    )
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      jsonrpc: '1.0',
      method: 'getblockcount',
      params: []
    })
  })

  it('passes method params through for getblock/getblockhash/rawtx calls', async () => {
    const rpc = new BitcoinRpc(NODE_URL, USER, PASS)

    mockFetch.mockResolvedValueOnce(rpcResult({ height: 1 }))
    await rpc.getBlock('abc')
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).params).toStrictEqual([
      'abc',
      1
    ])

    mockFetch.mockResolvedValueOnce(rpcResult('abc'))
    await rpc.getBlockHash(100)
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).params).toStrictEqual([
      100
    ])

    mockFetch.mockResolvedValueOnce(rpcResult({}))
    await rpc.getRawTransaction('txid1')
    expect(JSON.parse(mockFetch.mock.calls[2][1].body).params).toStrictEqual([
      'txid1',
      true
    ])

    mockFetch.mockResolvedValueOnce(rpcResult('deadbeef'))
    await rpc.getRawTransactionHex('txid1')
    expect(JSON.parse(mockFetch.mock.calls[3][1].body).params).toStrictEqual([
      'txid1',
      false
    ])
  })

  it('creates watch-only descriptor wallets with the expected flags', async () => {
    mockFetch.mockResolvedValueOnce(rpcResult({ name: 'w' }))
    const rpc = new BitcoinRpc(NODE_URL, USER, PASS)

    await rpc.createWallet('w')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.method).toBe('createwallet')
    expect(body.params).toStrictEqual(['w', true, true, '', false, true, true])
  })

  it('throws a descriptive error when the node returns an RPC error', async () => {
    mockFetch.mockResolvedValueOnce(rpcError(-8, 'Block height out of range'))
    const rpc = new BitcoinRpc(NODE_URL, USER, PASS)

    await expect(rpc.getBlockHash(-1)).rejects.toThrow(
      'RPC error -8: Block height out of range'
    )
  })

  it('maps HTTP 401 to an authentication error message', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401))
    const rpc = new BitcoinRpc(NODE_URL, USER, PASS)

    await expect(rpc.getBlockCount()).rejects.toThrow(/HTTP 401/)
  })

  it('maps HTTP 403 to an rpcallowip hint', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 403))
    const rpc = new BitcoinRpc(NODE_URL, USER, PASS)

    await expect(rpc.getBlockCount()).rejects.toThrow(/HTTP 403/)
  })

  it('surfaces other non-OK HTTP statuses verbatim', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 500))
    const rpc = new BitcoinRpc(NODE_URL, USER, PASS)

    await expect(rpc.getBlockCount()).rejects.toThrow('Node returned HTTP 500')
  })

  it('translates connection failures into an actionable message', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to connect'))
    const rpc = new BitcoinRpc(NODE_URL, USER, PASS)

    await expect(rpc.getBlockCount()).rejects.toThrow(/Could not reach node/)
  })

  it('translates abort/timeout errors into an actionable message', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    mockFetch.mockRejectedValueOnce(abortError)
    const rpc = new BitcoinRpc(NODE_URL, USER, PASS)

    await expect(rpc.getBlockCount()).rejects.toThrow(/timed out/)
  })

  describe('hasBlockFilterIndex', () => {
    it('returns true when the basic block filter index is present', async () => {
      mockFetch.mockResolvedValueOnce(
        rpcResult({
          'basic block filter index': { best_block_height: 1, synced: true }
        })
      )
      const rpc = new BitcoinRpc(NODE_URL, USER, PASS)
      await expect(rpc.hasBlockFilterIndex()).resolves.toBe(true)
    })

    it('returns false when no filter index is configured', async () => {
      mockFetch.mockResolvedValueOnce(rpcResult({}))
      const rpc = new BitcoinRpc(NODE_URL, USER, PASS)
      await expect(rpc.hasBlockFilterIndex()).resolves.toBe(false)
    })

    it('returns false (not a throw) when getindexinfo is unsupported', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Method not found'))
      const rpc = new BitcoinRpc(NODE_URL, USER, PASS)
      await expect(rpc.hasBlockFilterIndex()).resolves.toBe(false)
    })
  })

  describe('bitcoinRpc.test', () => {
    beforeEach(() => {
      // AbortController timeout in fetchWithTimeout uses setTimeout.
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('resolves true when the node responds', async () => {
      mockFetch.mockResolvedValueOnce(rpcResult({ blocks: 1, chain: 'main' }))
      const ok = await BitcoinRpc.test(NODE_URL, USER, PASS, 5000)
      expect(ok).toBe(true)
    })

    it('resolves false when the node errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('boom'))
      const ok = await BitcoinRpc.test(NODE_URL, USER, PASS, 5000)
      expect(ok).toBe(false)
    })

    it('resolves false when the call does not complete before the timeout', async () => {
      mockFetch.mockImplementationOnce(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal
            if (!signal) {
              return
            }
            const abort = () => {
              const err = new Error('The operation was aborted')
              err.name = 'AbortError'
              reject(err)
            }
            if (signal.aborted) {
              abort()
              return
            }
            signal.addEventListener('abort', abort, { once: true })
          })
      )

      const promise = BitcoinRpc.test(NODE_URL, USER, PASS, 10)
      await jest.advanceTimersByTimeAsync(10)

      await expect(promise).resolves.toBe(false)
    })

    it('passes the timeout budget into the AbortController', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
      mockFetch.mockResolvedValueOnce(rpcResult({ blocks: 1, chain: 'main' }))

      await BitcoinRpc.test(NODE_URL, USER, PASS, 1234)

      expect(setTimeoutSpy.mock.calls.map((call) => call[1])).toContain(1234)
    })
  })
})

describe('bitcoinCoreWallet', () => {
  let mockFetch: jest.Mock

  beforeEach(() => {
    mockFetch = jest.fn()
    global.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('builds the wallet-scoped URL, URL-encoding the wallet name', async () => {
    mockFetch.mockResolvedValueOnce(rpcResult({ balance: 0 }))
    const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'my wallet/x')

    await wallet.getWalletInfo()

    expect(wallet.name).toBe('my wallet/x')
    expect(mockFetch.mock.calls[0][0]).toBe(
      `${NODE_URL}/wallet/${encodeURIComponent('my wallet/x')}`
    )
  })

  it('sends node-level calls (listWallets) to the base URL, not the wallet URL', async () => {
    mockFetch.mockResolvedValueOnce(rpcResult(['other-wallet']))
    const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

    // ensureWallet triggers listWallets (a node-level call) before anything
    // wallet-scoped, then loadWallet since 'w' isn't in the loaded list.
    mockFetch.mockResolvedValueOnce(rpcResult({ name: 'w' }))
    await wallet.ensureWallet()

    expect(mockFetch.mock.calls[0][0]).toBe(NODE_URL)
    expect(mockFetch.mock.calls[1][0]).toBe(NODE_URL)
  })

  describe('ensureWallet', () => {
    it('does nothing when the wallet is already loaded', async () => {
      mockFetch.mockResolvedValueOnce(rpcResult(['w']))
      const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

      await wallet.ensureWallet()

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('loads an existing-on-disk wallet instead of creating a new one', async () => {
      mockFetch.mockResolvedValueOnce(rpcResult([])) // listwallets
      mockFetch.mockResolvedValueOnce(rpcResult({ name: 'w' })) // loadwallet
      const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

      await wallet.ensureWallet()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      const loadBody = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(loadBody.method).toBe('loadwallet')
    })

    it('creates a new wallet when it does not exist on disk', async () => {
      mockFetch.mockResolvedValueOnce(rpcResult([])) // listwallets
      mockFetch.mockRejectedValueOnce(new Error('Wallet file not found')) // loadwallet fails
      mockFetch.mockResolvedValueOnce(rpcResult({ name: 'w' })) // createwallet
      const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

      await wallet.ensureWallet()

      expect(mockFetch).toHaveBeenCalledTimes(3)
      const createBody = JSON.parse(mockFetch.mock.calls[2][1].body)
      expect(createBody.method).toBe('createwallet')
      expect(createBody.params).toStrictEqual([
        'w',
        true,
        true,
        '',
        false,
        true,
        true
      ])
    })
  })

  it('sends abortrescan on the wallet-scoped URL', async () => {
    mockFetch.mockResolvedValueOnce(rpcResult(true))
    const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

    await expect(wallet.abortRescan()).resolves.toBe(true)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.method).toBe('abortrescan')
  })

  it('listSinceBlock requests include_removed so reorgs can be reconciled', async () => {
    mockFetch.mockResolvedValueOnce(
      rpcResult({ lastblock: 'hash', removed: [], transactions: [] })
    )
    const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

    await wallet.listSinceBlock('startHash')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.method).toBe('listsinceblock')
    expect(body.params).toStrictEqual(['startHash', 1, true, true])
  })

  it('listUnspent requests the full confirmation range', async () => {
    mockFetch.mockResolvedValueOnce(rpcResult([]))
    const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

    await wallet.listUnspent()

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.params).toStrictEqual([0, 9999999])
  })

  it('listTransactions defaults to a large count and includes watch-only', async () => {
    mockFetch.mockResolvedValueOnce(rpcResult([]))
    const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

    await wallet.listTransactions()

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.params).toStrictEqual(['*', 99999, 0, true])
  })

  it('getTransaction requests the verbose/decoded form', async () => {
    mockFetch.mockResolvedValueOnce(rpcResult({}))
    const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

    await wallet.getTransaction('txid1')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.params).toStrictEqual(['txid1', true, true])
  })

  it('normalizeDescriptors resolves both descriptors in parallel via the node RPC', async () => {
    mockFetch.mockResolvedValueOnce(
      rpcResult({
        descriptor: 'ext#checksum1',
        isrange: true,
        issolvable: true
      })
    )
    mockFetch.mockResolvedValueOnce(
      rpcResult({
        descriptor: 'int#checksum2',
        isrange: true,
        issolvable: true
      })
    )
    const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

    const [ext, int] = await wallet.normalizeDescriptors('ext-raw', 'int-raw')

    expect(ext).toBe('ext#checksum1')
    expect(int).toBe('int#checksum2')
    // both getdescriptorinfo calls go to the node URL, not the wallet URL
    expect(mockFetch.mock.calls[0][0]).toBe(NODE_URL)
    expect(mockFetch.mock.calls[1][0]).toBe(NODE_URL)
  })

  it('rescanBlockchain uses a multi-hour timeout budget instead of the RPC default', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    mockFetch.mockResolvedValueOnce(
      rpcResult({ start_height: 0, stop_height: 100 })
    )
    const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

    const result = await wallet.rescanBlockchain(0)

    expect(result).toStrictEqual({ start_height: 0, stop_height: 100 })
    const delays = setTimeoutSpy.mock.calls.map((call) => call[1])
    const sixHoursMs = 6 * 60 * 60 * 1000
    expect(delays).toContain(sixHoursMs)
    expect(delays).not.toContain(RPC_DEFAULT_TIMEOUT_MS)
  })

  it('propagates RPC errors from wallet-scoped calls', async () => {
    mockFetch.mockResolvedValueOnce(rpcError(-4, 'Insufficient funds'))
    const wallet = new BitcoinCoreWallet(NODE_URL, USER, PASS, 'w')

    await expect(wallet.createPsbt([], [{ addr: 0.001 }])).rejects.toThrow(
      'RPC error -4: Insufficient funds'
    )
  })
})
