import {
  scanProgressHeight,
  startRescan,
  summarizeWalletTxs,
  toSinglePathDescriptors
} from '@/api/coreWalletSync'
import { BitcoinCoreWallet } from '@/api/rpc'
import { BDK_RESCAN_START_RACE_TIMEOUT_MS } from '@/constants/bdk'

// See bdkRpc.test.ts: stubs keep `@/api/bdk`'s module graph loadable.
jest.mock<typeof import('@/utils/bip39')>('@/utils/bip39', () => ({
  detectElectrumSeed: jest.fn(() => null),
  getPrivateDescriptorFromElectrumMnemonic: jest.fn(),
  getPrivateDescriptorFromMnemonic: jest.fn(),
  mnemonicToSeed: jest.fn(() => new Uint8Array())
}))

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  default: {} as unknown as typeof import('@/api/electrum').default
}))

function makeCoreWallet() {
  return new BitcoinCoreWallet('http://localhost:8332', 'u', 'p', 'w')
}

describe('toSinglePathDescriptors', () => {
  it('splits a multi-path descriptor into receive/change and drops the checksum', () => {
    const desc = 'wpkh([abcd1234/84h/0h/0h]xpub123/<0;1>/*)#abcdefgh'
    expect(toSinglePathDescriptors(desc, desc)).toStrictEqual([
      'wpkh([abcd1234/84h/0h/0h]xpub123/0/*)',
      'wpkh([abcd1234/84h/0h/0h]xpub123/1/*)'
    ])
  })

  it('keeps single-path descriptors as-is minus the checksum', () => {
    expect(
      toSinglePathDescriptors('wpkh(xpub/0/*)#abcdefgh', 'wpkh(xpub/1/*)')
    ).toStrictEqual(['wpkh(xpub/0/*)', 'wpkh(xpub/1/*)'])
  })
})

describe('summarizeWalletTxs', () => {
  it('aggregates outputs per txid in sats and drops re-orged txids', () => {
    const entry = { blockheight: 10, blocktime: 1, time: 1 }
    const result = summarizeWalletTxs(
      [
        { ...entry, amount: 0.5, category: 'receive', txid: 'a' },
        { ...entry, amount: 0.25, category: 'receive', txid: 'a' },
        { ...entry, amount: -0.1, category: 'send', txid: 'a' },
        { ...entry, amount: 1, category: 'receive', txid: 'gone' }
      ],
      ['gone']
    )
    expect([...result.keys()]).toStrictEqual(['a'])
    expect(result.get('a')).toMatchObject({
      received: 75_000_000,
      sent: 10_000_000
    })
  })
})

describe('scanProgressHeight', () => {
  it('maps the scan fraction onto the scanned height range', () => {
    expect(scanProgressHeight({ duration: 1, progress: 0.5 }, 100, 200)).toBe(
      150
    )
    expect(scanProgressHeight(true, 100, 200)).toBe(100)
    expect(scanProgressHeight(false, 100, 200)).toBe(200)
  })
})

describe('startRescan', () => {
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('resolves after the race timeout while Core keeps scanning', async () => {
    jest.useFakeTimers()
    const coreWallet = makeCoreWallet()
    jest
      .spyOn(coreWallet, 'rescanBlockchain')
      .mockReturnValue(new Promise(jest.fn()))

    const started = startRescan(coreWallet, 0)
    jest.advanceTimersByTime(BDK_RESCAN_START_RACE_TIMEOUT_MS)
    await expect(started).resolves.toBeUndefined()
  })

  it('rejects with the rescan error and clears the timeout', async () => {
    jest.useFakeTimers()
    const coreWallet = makeCoreWallet()
    jest
      .spyOn(coreWallet, 'rescanBlockchain')
      .mockRejectedValue(new Error('Wallet is currently rescanning'))

    await expect(startRescan(coreWallet, 0)).rejects.toThrow('rescanning')
    expect(jest.getTimerCount()).toBe(0)
  })
})
