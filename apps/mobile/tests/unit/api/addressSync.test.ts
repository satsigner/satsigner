import * as bitcoinjs from 'bitcoinjs-lib'

import {
  type AddressSyncProgress,
  fetchAddressSnapshot
} from '@/api/addressSync'
import { type EsploraTx } from '@/types/models/Esplora'
import { type Transaction } from '@/types/models/Transaction'

const ADDRESS = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
const OTHER_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
const BLOCK_HEIGHT = 800_000
const BLOCK_TIME = 1_700_000_000

const mockEsplora = {
  getAddressTxs: jest.fn(),
  getAddressUtxos: jest.fn(),
  getTxHex: jest.fn()
}

jest.mock<typeof import('@/api/esplora')>('@/api/esplora', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    getAddressTxs: (...args: unknown[]) => mockEsplora.getAddressTxs(...args),
    getAddressUtxos: (...args: unknown[]) =>
      mockEsplora.getAddressUtxos(...args),
    getTxHex: (...args: unknown[]) => mockEsplora.getTxHex(...args)
  })
}))

const mockElectrum = {
  close: jest.fn(),
  getAddressBalance: jest.fn(),
  getAddressTransactions: jest.fn(),
  getAddressUtxos: jest.fn(),
  getBlockTimestamp: jest.fn(),
  getTransactionRaw: jest.fn(),
  init: jest.fn(),
  parseAddressPartialTransactions: jest.fn(
    (_address: string, txs: Transaction[]) => txs
  )
}

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  closeElectrumClientQuietly: () => mockElectrum.close(),
  default: { fromUrl: () => mockElectrum }
}))

function storedTx(id: string, blockHeight?: number): Transaction {
  return {
    blockHeight,
    id,
    label: 'rent',
    lockTimeEnabled: false,
    prices: { USD: 1 },
    received: 0,
    sent: 0,
    type: 'receive',
    vin: [],
    vout: []
  }
}

function esploraTx(txid: string, blockHeight?: number): EsploraTx {
  return {
    fee: 250,
    locktime: 0,
    size: 200,
    status: {
      block_height: blockHeight,
      block_time: blockHeight ? BLOCK_TIME : undefined,
      confirmed: blockHeight !== undefined
    },
    txid,
    version: 2,
    vin: [
      {
        is_coinbase: false,
        prevout: { scriptpubkey_address: ADDRESS, value: 100_000 },
        scriptsig: '',
        sequence: 0xffff_ffff,
        txid: 'bb'.repeat(32),
        vout: 0
      }
    ],
    vout: [
      { scriptpubkey_address: OTHER_ADDRESS, value: 60_000 },
      { scriptpubkey_address: ADDRESS, value: 39_750 }
    ],
    weight: 800
  }
}

function rawTxHex(seed: number) {
  const tx = new bitcoinjs.Transaction()
  tx.addInput(Buffer.alloc(32, seed), 0)
  tx.addOutput(bitcoinjs.address.toOutputScript(ADDRESS), 1000)
  return tx.toHex()
}

function txidOf(rawHex: string) {
  return bitcoinjs.Transaction.fromHex(rawHex).getId()
}

function progressRecorder() {
  const totals = { added: 0, done: 0 }
  const onProgress: AddressSyncProgress = (done, added) => {
    totals.done += done
    totals.added += added
  }
  return { onProgress, totals }
}

type SyncServer = Parameters<typeof fetchAddressSnapshot>[0]

const ESPLORA: SyncServer = {
  backend: 'esplora',
  network: 'bitcoin',
  url: 'https://x'
}
const ELECTRUM: SyncServer = {
  backend: 'electrum',
  network: 'bitcoin',
  url: 'ssl://x:1'
}

describe('fetchAddressSnapshot with esplora', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEsplora.getAddressUtxos.mockResolvedValue([])
    mockEsplora.getTxHex.mockResolvedValue('00')
  })

  it('maps new transactions and attaches their raw bytes', async () => {
    mockEsplora.getAddressTxs.mockResolvedValue([esploraTx('aa', BLOCK_HEIGHT)])
    const { onProgress, totals } = progressRecorder()

    const snapshot = await fetchAddressSnapshot(
      ESPLORA,
      ADDRESS,
      [],
      onProgress
    )

    expect(snapshot.transactions).toHaveLength(1)
    expect(snapshot.transactions[0]).toMatchObject({
      blockHeight: BLOCK_HEIGHT,
      id: 'aa',
      raw: [0],
      received: 39_750,
      sent: 100_000,
      type: 'send'
    })
    expect(totals.done).toBe(totals.added)
  })

  it('moves known transactions that confirmed and skips unchanged ones', async () => {
    mockEsplora.getAddressTxs.mockResolvedValue([
      esploraTx('mempool', BLOCK_HEIGHT),
      esploraTx('settled', BLOCK_HEIGHT)
    ])

    const snapshot = await fetchAddressSnapshot(
      ESPLORA,
      ADDRESS,
      [storedTx('mempool'), storedTx('settled', BLOCK_HEIGHT)],
      jest.fn()
    )

    expect(mockEsplora.getTxHex).not.toHaveBeenCalled()
    expect(snapshot.transactions).toStrictEqual([
      {
        ...storedTx('mempool'),
        blockHeight: BLOCK_HEIGHT,
        prices: {},
        timestamp: new Date(BLOCK_TIME * 1000)
      }
    ])
  })

  it('keeps older confirmed history that pagination stopped before', async () => {
    mockEsplora.getAddressTxs.mockResolvedValue([
      esploraTx('recent', BLOCK_HEIGHT)
    ])

    const snapshot = await fetchAddressSnapshot(
      ESPLORA,
      ADDRESS,
      [
        { ...storedTx('recent', BLOCK_HEIGHT), address: ADDRESS },
        { ...storedTx('older', 1), address: ADDRESS },
        { ...storedTx('replaced'), address: ADDRESS },
        { ...storedTx('elsewhere', 1), address: OTHER_ADDRESS }
      ],
      jest.fn()
    )

    expect(snapshot.txids).toStrictEqual(['recent', 'older'])
  })
})

describe('fetchAddressSnapshot with electrum', () => {
  const mempoolHex = rawTxHex(1)
  const orphanHex = rawTxHex(2)
  const confirmedHex = rawTxHex(3)

  beforeEach(() => {
    jest.clearAllMocks()
    mockElectrum.getAddressBalance.mockResolvedValue({
      confirmed: 1000,
      unconfirmed: 0
    })
    mockElectrum.getAddressUtxos.mockResolvedValue([])
    mockElectrum.getBlockTimestamp.mockResolvedValue(BLOCK_TIME)
    mockElectrum.getTransactionRaw.mockImplementation(
      (txid: string) =>
        [mempoolHex, orphanHex, confirmedHex].find(
          (rawHex) => txidOf(rawHex) === txid
        ) ?? ''
    )
  })

  it('leaves mempool transactions unconfirmed without block lookups', async () => {
    mockElectrum.getAddressTransactions.mockResolvedValue([
      { height: 0, tx_hash: txidOf(mempoolHex) },
      { height: -1, tx_hash: txidOf(orphanHex) }
    ])
    const { onProgress, totals } = progressRecorder()

    const snapshot = await fetchAddressSnapshot(
      ELECTRUM,
      ADDRESS,
      [],
      onProgress
    )

    expect(mockElectrum.getBlockTimestamp).not.toHaveBeenCalled()
    expect(
      snapshot.transactions.map(({ blockHeight, timestamp }) => ({
        blockHeight,
        timestamp
      }))
    ).toStrictEqual([
      { blockHeight: undefined, timestamp: undefined },
      { blockHeight: undefined, timestamp: undefined }
    ])
    expect(totals.done).toBe(totals.added)
    expect(mockElectrum.close).toHaveBeenCalledTimes(1)
  })

  it('closes the client when the connection fails', async () => {
    mockElectrum.init.mockRejectedValueOnce(new Error('offline'))

    await expect(
      fetchAddressSnapshot(ELECTRUM, ADDRESS, [], jest.fn())
    ).rejects.toThrow('offline')
    expect(mockElectrum.close).toHaveBeenCalledTimes(1)
  })

  it('moves known transactions that confirmed', async () => {
    const txid = txidOf(confirmedHex)
    mockElectrum.getAddressTransactions.mockResolvedValue([
      { height: BLOCK_HEIGHT, tx_hash: txid }
    ])
    const { onProgress, totals } = progressRecorder()

    const snapshot = await fetchAddressSnapshot(
      ELECTRUM,
      ADDRESS,
      [storedTx(txid, 0)],
      onProgress
    )

    expect(mockElectrum.getTransactionRaw).not.toHaveBeenCalled()
    expect(mockElectrum.getBlockTimestamp).toHaveBeenCalledWith(BLOCK_HEIGHT)
    expect(snapshot.transactions).toStrictEqual([
      {
        ...storedTx(txid),
        blockHeight: BLOCK_HEIGHT,
        prices: {},
        timestamp: new Date(BLOCK_TIME * 1000)
      }
    ])
    expect(totals.done).toBe(totals.added)
  })

  it('dates utxos by the transaction that created them', async () => {
    const txid = txidOf(confirmedHex)
    mockElectrum.getAddressTransactions.mockResolvedValue([
      { height: BLOCK_HEIGHT, tx_hash: txid }
    ])
    mockElectrum.getAddressUtxos.mockResolvedValue([
      { height: BLOCK_HEIGHT, tx_hash: txid, tx_pos: 0, value: 1000 }
    ])

    const snapshot = await fetchAddressSnapshot(
      ELECTRUM,
      ADDRESS,
      [],
      jest.fn()
    )

    expect(mockElectrum.getBlockTimestamp).toHaveBeenCalledTimes(1)
    expect(snapshot.utxos).toStrictEqual([
      {
        timestamp: new Date(BLOCK_TIME * 1000),
        txid,
        value: 1000,
        vout: 0
      }
    ])
  })
})
