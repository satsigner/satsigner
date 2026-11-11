import { BdkWallet, Network } from 'react-native-bdk-sdk'

import { syncWallet } from '@/api/bdk'

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
  signal?: AbortSignal
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
    signal
  )
}

// The native bindings throw "Cannot lower this object to a pointer" for any
// JS progress inspector, which Jest's BDK mock cannot reproduce.
describe('syncWallet progress inspector', () => {
  it.each([
    ['esplora', ESPLORA_URL, true, 'fullScanWithEsplora'],
    ['esplora', ESPLORA_URL, false, 'syncWithEsplora'],
    ['electrum', ELECTRUM_URL, true, 'fullScanWithElectrum'],
    ['electrum', ELECTRUM_URL, false, 'syncWithElectrum']
  ] as const)(
    'scans %s (full scan: %s) without one and keeps the abort signal',
    async (backend, url, isFullScan, method) => {
      const { raw, wallet } = makeWallet()
      const { signal } = new AbortController()

      await runSync(wallet, backend, url, isFullScan, signal)

      expect(raw[method]).toHaveBeenCalledWith(
        expect.anything(),
        BigInt(STOP_GAP),
        undefined,
        { signal }
      )
      expect(wallet.persist).toHaveBeenCalledTimes(1)
    }
  )

  it('syncs over RPC without one', async () => {
    const { wallet } = makeWallet()

    await runSync(wallet, 'rpc', RPC_URL, false)

    expect(wallet.syncWithRpc).toHaveBeenCalledWith(expect.anything(), 0, {
      fetchMempool: true
    })
  })
})
