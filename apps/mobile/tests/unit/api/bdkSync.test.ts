import { BdkWallet, KeychainKind, Network } from 'react-native-bdk-sdk'

import { syncWallet } from '@/api/bdk'
import { BDK_PROGRESS_THROTTLE_MS } from '@/constants/bdk'

type SyncInspector = { inspect: (consumed: bigint, total: bigint) => void }
type FullScanInspector = {
  inspect: (keychain: KeychainKind, index: number, visited: bigint) => void
}

// Same module-graph stubs as bdkRpc.test.ts: @/utils/bip39 and @/api/electrum
// cannot load under Jest, and nothing here exercises them.
jest.mock<typeof import('@/utils/bip39')>('@/utils/bip39', () => ({
  detectElectrumSeed: jest.fn(() => null),
  getPrivateDescriptorFromElectrumMnemonic: jest.fn(),
  getPrivateDescriptorFromMnemonic: jest.fn(),
  mnemonicToSeed: jest.fn(() => new Uint8Array())
}))

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  default: {} as unknown as typeof import('@/api/electrum').default
}))

jest.mock<typeof import('@/api/electrumReachability')>(
  '@/api/electrumReachability',
  () => ({
    ...jest.requireActual<typeof import('@/api/electrumReachability')>(
      '@/api/electrumReachability'
    ),
    assertElectrumReachable: jest.fn(() => Promise.resolve())
  })
)

const ESPLORA_URL = 'https://mempool.space/signet/api'
const ELECTRUM_URL = 'ssl://mempool.space:60602'
const RPC_URL = 'http://127.0.0.1:38332'
const STOP_GAP = 20

function makeWallet() {
  const wallet = new BdkWallet('', undefined, Network.Signet, '')
  const raw = {
    fullScanWithElectrum: jest.fn(() => Promise.resolve()),
    fullScanWithEsplora: jest.fn(() => Promise.resolve()),
    syncWithElectrum: jest.fn(() => Promise.resolve()),
    syncWithEsplora: jest.fn(() => Promise.resolve())
  }
  Object.defineProperty(wallet, 'raw', { value: raw })
  return { raw, wallet }
}

function runSync(
  wallet: BdkWallet,
  backend: 'electrum' | 'esplora' | 'rpc',
  url: string,
  isFullScan: boolean,
  options: Parameters<typeof syncWallet>[10] = {}
) {
  return syncWallet(
    wallet,
    backend,
    url,
    STOP_GAP,
    isFullScan,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    options
  )
}

describe('syncWallet progress inspector', () => {
  it.each([
    ['esplora', ESPLORA_URL, true, 'fullScanWithEsplora'],
    ['esplora', ESPLORA_URL, false, 'syncWithEsplora'],
    ['electrum', ELECTRUM_URL, true, 'fullScanWithElectrum'],
    ['electrum', ELECTRUM_URL, false, 'syncWithElectrum']
  ] as const)(
    'scans %s (full scan: %s) with one and keeps the abort signal',
    async (backend, url, isFullScan, method) => {
      const { raw, wallet } = makeWallet()
      const { signal } = new AbortController()

      await runSync(wallet, backend, url, isFullScan, {
        onProgress: jest.fn(),
        signal
      })

      expect(raw[method]).toHaveBeenCalledWith(
        expect.anything(),
        BigInt(STOP_GAP),
        { inspect: expect.any(Function) },
        { signal }
      )
      expect(wallet.persist).toHaveBeenCalledTimes(1)
    }
  )

  it('passes no inspector when nobody follows the progress', async () => {
    const { raw, wallet } = makeWallet()

    await runSync(wallet, 'electrum', ELECTRUM_URL, false)

    expect(raw.syncWithElectrum).toHaveBeenCalledWith(
      expect.anything(),
      BigInt(STOP_GAP),
      undefined,
      undefined
    )
  })

  it('reports how many scripts a sync has checked', async () => {
    const { raw, wallet } = makeWallet()
    const onProgress = jest.fn()
    raw.syncWithEsplora.mockImplementation(
      (_client: unknown, _gap: bigint, inspector: SyncInspector) => {
        inspector.inspect(40n, 40n)
        return Promise.resolve()
      }
    )

    await runSync(wallet, 'esplora', ESPLORA_URL, false, { onProgress })

    expect(onProgress).toHaveBeenCalledWith(40, 40)
  })

  it('reports full scan progress with no fixed total', async () => {
    const { raw, wallet } = makeWallet()
    const onProgress = jest.fn()
    raw.fullScanWithElectrum.mockImplementation(
      (_client: unknown, _gap: bigint, inspector: FullScanInspector) => {
        inspector.inspect(KeychainKind.External, 6, 7n)
        return Promise.resolve()
      }
    )

    await runSync(wallet, 'electrum', ELECTRUM_URL, true, { onProgress })

    expect(onProgress).toHaveBeenCalledWith(7, 0)
  })

  it('reports RPC sync progress by block height', async () => {
    const { wallet } = makeWallet()
    const onProgress = jest.fn()
    jest
      .mocked(wallet.syncWithRpc)
      .mockImplementation((_client, _start, opts) => {
        opts?.inspector?.inspect({
          currentHeight: 500,
          progress: 1,
          tipHeight: 500
        })
        return Promise.resolve()
      })

    await runSync(wallet, 'rpc', RPC_URL, false, { onProgress })

    expect(wallet.syncWithRpc).toHaveBeenCalledWith(expect.anything(), 0, {
      fetchMempool: true,
      inspector: { inspect: expect.any(Function) }
    })
    expect(onProgress).toHaveBeenCalledWith(500, 500)
  })
})

describe('syncWallet progress throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('sends one update per window and drops one left when the scan ends', async () => {
    const { raw, wallet } = makeWallet()
    const onProgress = jest.fn()
    raw.fullScanWithEsplora.mockImplementation(
      (_client: unknown, _gap: bigint, inspector: FullScanInspector) => {
        inspector.inspect(KeychainKind.External, 0, 1n)
        inspector.inspect(KeychainKind.External, 1, 2n)
        inspector.inspect(KeychainKind.External, 2, 3n)
        return Promise.resolve()
      }
    )

    await runSync(wallet, 'esplora', ESPLORA_URL, true, { onProgress })
    await jest.advanceTimersByTimeAsync(BDK_PROGRESS_THROTTLE_MS)

    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith(1, 0)
  })

  it('always sends the final update of a sync', async () => {
    const { raw, wallet } = makeWallet()
    const onProgress = jest.fn()
    raw.syncWithElectrum.mockImplementation(
      (_client: unknown, _gap: bigint, inspector: SyncInspector) => {
        inspector.inspect(1n, 3n)
        inspector.inspect(2n, 3n)
        inspector.inspect(3n, 3n)
        return Promise.resolve()
      }
    )

    await runSync(wallet, 'electrum', ELECTRUM_URL, false, { onProgress })

    expect(onProgress.mock.calls).toStrictEqual([
      [1, 3],
      [3, 3]
    ])
  })
})
