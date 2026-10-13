import {
  mergeWalletTxEntries,
  scanProgressHeight,
  startRescan,
  startRescanFrom,
  summarizeWalletTxs,
  toSinglePathDescriptors
} from '@/api/coreWalletSync'
import { BitcoinCoreWallet, type CoreWalletInfo } from '@/api/rpc'
import { BDK_RESCAN_START_RACE_TIMEOUT_MS } from '@/constants/bdk'

const RESCAN_IN_PROGRESS_MESSAGE =
  'RPC error -4: Wallet is currently rescanning. Abort existing rescan or wait.'

const IDLE_WALLET_INFO: CoreWalletInfo = {
  balance: 0,
  descriptors: true,
  scanning: false,
  unconfirmed_balance: 0,
  walletname: 'w'
}

// See bdkRpc.test.ts: stubs keep `@/api/bdk`'s module graph loadable.
jest.mock<typeof import('@/utils/bip39')>('@/utils/bip39', () => ({
  detectElectrumSeed: jest.fn(() => null),
  getPrivateDescriptorFromElectrumMnemonic: jest.fn(),
  getPrivateDescriptorFromMnemonic: jest.fn(),
  mnemonicToSeed: jest.fn(() => new Uint8Array())
}))

jest.mock<Partial<typeof import('@/api/electrum')>>(
  '@/api/electrum',
  () => ({})
)

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
    const entry = { blockheight: 10, blocktime: 1 }
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

describe('mergeWalletTxEntries', () => {
  it('keeps Core entries over stored ones for the same txid', () => {
    const entry = { blockheight: 10, blocktime: 1 }
    const merged = mergeWalletTxEntries(
      [{ ...entry, amount: 0.5, category: 'receive', txid: 'a' }],
      [
        { ...entry, amount: 0.5, category: 'receive', txid: 'a' },
        { ...entry, amount: 0.2, category: 'receive', txid: 'b' }
      ]
    )
    expect(merged.map((e) => e.txid)).toStrictEqual(['a', 'b'])
    expect(summarizeWalletTxs(merged).get('a')?.received).toBe(50_000_000)
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

describe('startRescanFrom', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('stops the running scan and retries when Core is already rescanning', async () => {
    const coreWallet = makeCoreWallet()
    jest.spyOn(coreWallet, 'getWalletInfo').mockResolvedValue(IDLE_WALLET_INFO)
    const rescan = jest
      .spyOn(coreWallet, 'rescanBlockchain')
      .mockRejectedValueOnce(new Error(RESCAN_IN_PROGRESS_MESSAGE))
      .mockResolvedValueOnce({ start_height: 0, stop_height: 10 })

    await expect(startRescanFrom(coreWallet, 0)).resolves.toBeUndefined()
    expect(rescan).toHaveBeenCalledTimes(2)
  })

  it('rethrows other rescan errors without retrying', async () => {
    const coreWallet = makeCoreWallet()
    const rescan = jest
      .spyOn(coreWallet, 'rescanBlockchain')
      .mockRejectedValue(new Error('RPC error -8: Invalid start_height'))

    await expect(startRescanFrom(coreWallet, 0)).rejects.toThrow(
      'Invalid start_height'
    )
    expect(rescan).toHaveBeenCalledTimes(1)
  })
})
