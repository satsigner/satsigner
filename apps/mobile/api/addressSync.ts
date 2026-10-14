import { hex } from '@scure/base'
import * as bitcoinjs from 'bitcoinjs-lib'

import { MS_PER_SECOND } from '@/constants/time'
import { type Transaction } from '@/types/models/Transaction'
import { type Network, type Server } from '@/types/settings/blockchain'
import { mapEsploraTxToAddressTransaction } from '@/utils/explorerAddressTx'

import ElectrumClient, { closeElectrumClientQuietly } from './electrum'
import Esplora from './esplora'

// Raw tx hex requests sent to Esplora at once.
const ESPLORA_TX_HEX_BATCH_SIZE = 4

export type AddressSnapshotUtxo = {
  txid: string
  vout: number
  value: number
  timestamp?: Date
}

/** What one backend knows about a single address, in app types. */
export type AddressSnapshot = {
  /** Transactions to add to the account, or replace by id. */
  transactions: Transaction[]
  /** The full current unspent set of the address. */
  utxos: AddressSnapshotUtxo[]
  balance: { confirmed: number; unconfirmed: number }
  /** Txids of the address history the backend returned. */
  txids: string[]
}

/** Reports work as deltas: tasks finished and tasks newly scheduled. */
export type AddressSyncProgress = (done: number, added: number) => void

function toDate(unixSeconds: number | undefined) {
  return unixSeconds ? new Date(unixSeconds * MS_PER_SECOND) : undefined
}

/**
 * Returns the stored transaction when the backend now places it in another
 * block (it confirmed, or a reorg moved it), otherwise undefined.
 */
function movedTransaction(
  knownById: Map<string, Transaction>,
  txid: string,
  blockHeight: number | undefined
) {
  const stored = knownById.get(txid)
  if (!stored || stored.blockHeight === blockHeight) {
    return undefined
  }
  return stored
}

/**
 * Moves a stored transaction to its new block. Prices are dropped so they
 * are fetched again for the new timestamp.
 */
function reconfirmTransaction(
  tx: Transaction,
  blockHeight: number | undefined,
  timestamp: Date | undefined
): Transaction {
  return { ...tx, blockHeight, prices: {}, timestamp }
}

async function fetchEsploraTxHexes(
  esplora: Esplora,
  txids: string[],
  onProgress: AddressSyncProgress
) {
  const hexByTxid: Record<string, string> = {}
  for (let i = 0; i < txids.length; i += ESPLORA_TX_HEX_BATCH_SIZE) {
    const batch = txids.slice(i, i + ESPLORA_TX_HEX_BATCH_SIZE)
    const hexes = await Promise.all(batch.map((txid) => esplora.getTxHex(txid)))
    for (const [index, txid] of batch.entries()) {
      hexByTxid[txid] = hexes[index]
    }
    onProgress(batch.length, 0)
  }
  return hexByTxid
}

async function fetchEsploraSnapshot(
  url: string,
  address: string,
  knownTxs: Transaction[],
  onProgress: AddressSyncProgress
): Promise<AddressSnapshot> {
  const esplora = new Esplora(url)
  const knownById = new Map(knownTxs.map((tx) => [tx.id, tx]))

  onProgress(0, 2)
  // Stops paginating once a page holds only known txids.
  const esploraTxs = await esplora.getAddressTxs(
    address,
    new Set(knownById.keys())
  )
  const esploraUtxos = await esplora.getAddressUtxos(address)
  onProgress(2, 0)

  const newTxs = esploraTxs.filter((tx) => !knownById.has(tx.txid))
  onProgress(0, newTxs.length)
  const hexByTxid = await fetchEsploraTxHexes(
    esplora,
    newTxs.map((tx) => tx.txid),
    onProgress
  )

  const transactions: Transaction[] = newTxs.map((tx) => ({
    ...mapEsploraTxToAddressTransaction(tx, address),
    raw: Array.from(hex.decode(hexByTxid[tx.txid]))
  }))
  for (const { status, txid } of esploraTxs) {
    const moved = movedTransaction(knownById, txid, status.block_height)
    if (moved) {
      transactions.push(
        reconfirmTransaction(
          moved,
          status.block_height,
          toDate(status.block_time)
        )
      )
    }
  }

  // Pagination stops at known history, so older confirmed txids come from the
  // store. Unconfirmed known txs missing from the newest page were replaced.
  const fetchedTxids = new Set(esploraTxs.map((tx) => tx.txid))
  const olderTxids = knownTxs
    .filter(
      (tx) =>
        tx.address === address &&
        tx.blockHeight !== undefined &&
        !fetchedTxids.has(tx.id)
    )
    .map((tx) => tx.id)

  const balance = { confirmed: 0, unconfirmed: 0 }
  for (const utxo of esploraUtxos) {
    if (utxo.status.confirmed) {
      balance.confirmed += utxo.value
    } else {
      balance.unconfirmed += utxo.value
    }
  }

  return {
    balance,
    transactions,
    txids: [...fetchedTxids, ...olderTxids],
    utxos: esploraUtxos.map((utxo) => ({
      timestamp: toDate(utxo.status.block_time),
      txid: utxo.txid,
      value: utxo.value,
      vout: utxo.vout
    }))
  }
}

// Electrum reports height 0 for mempool transactions and -1 for those with
// unconfirmed parents.
function electrumBlockHeight(height: number) {
  return height > 0 ? height : undefined
}

async function readElectrumSnapshot(
  electrum: ElectrumClient,
  address: string,
  knownTxs: Transaction[],
  onProgress: AddressSyncProgress
): Promise<AddressSnapshot> {
  onProgress(0, 3)
  const electrumUtxos = await electrum.getAddressUtxos(address)
  const electrumTxs = await electrum.getAddressTransactions(address)
  const balance = await electrum.getAddressBalance(address)
  onProgress(3, 0)

  const knownById = new Map(knownTxs.map((tx) => [tx.id, tx]))
  const newTxs = electrumTxs.filter((tx) => !knownById.has(tx.tx_hash))
  const movedTxs = electrumTxs.filter((tx) =>
    movedTransaction(knownById, tx.tx_hash, electrumBlockHeight(tx.height))
  )
  onProgress(0, newTxs.length * 2 + movedTxs.length)

  const timestampByHeight: Record<number, number> = {}
  async function blockTime(height: number) {
    if (electrumBlockHeight(height) === undefined) {
      return undefined
    }
    if (!timestampByHeight[height]) {
      timestampByHeight[height] = await electrum.getBlockTimestamp(height)
    }
    return toDate(timestampByHeight[height])
  }

  // Partial transactions: received, sent, type, vin and vout are filled in by
  // parseAddressPartialTransactions below.
  const partialTxs: Transaction[] = []
  for (const { tx_hash: txid, height } of newTxs) {
    const rawTx = await electrum.getTransactionRaw(txid)
    onProgress(1, 0)
    const timestamp = await blockTime(height)
    onProgress(1, 0)

    const parsed = bitcoinjs.Transaction.fromHex(rawTx)
    partialTxs.push({
      address,
      blockHeight: electrumBlockHeight(height),
      id: parsed.getId(),
      label: '',
      lockTime: parsed.locktime,
      lockTimeEnabled: parsed.locktime > 0,
      prices: {},
      raw: Array.from(hex.decode(rawTx)),
      received: 0,
      sent: 0,
      size: parsed.byteLength(),
      timestamp,
      type: 'receive',
      version: parsed.version,
      vin: [],
      vout: [],
      vsize: parsed.virtualSize(),
      weight: parsed.weight()
    })
  }

  const reconfirmedById = new Map<string, Transaction>()
  for (const { tx_hash: txid, height } of electrumTxs) {
    const blockHeight = electrumBlockHeight(height)
    const moved = movedTransaction(knownById, txid, blockHeight)
    if (moved) {
      reconfirmedById.set(
        txid,
        reconfirmTransaction(moved, blockHeight, await blockTime(height))
      )
      onProgress(1, 0)
    }
  }

  const addressTxids = new Set(electrumTxs.map((tx) => tx.tx_hash))
  // Known transactions are parsed again so `sent` can see parents fetched now.
  const transactions = electrum.parseAddressPartialTransactions(address, [
    ...knownTxs
      .filter((tx) => addressTxids.has(tx.id))
      .map((tx) => reconfirmedById.get(tx.id) ?? tx),
    ...partialTxs
  ])

  // A UTXO confirms in the same block as the transaction that created it.
  const timestampByTxid = new Map(
    transactions.map((tx) => [tx.id, tx.timestamp])
  )

  return {
    balance,
    transactions,
    txids: electrumTxs.map((tx) => tx.tx_hash),
    utxos: electrumUtxos.map((utxo) => ({
      timestamp: timestampByTxid.get(utxo.tx_hash),
      txid: utxo.tx_hash,
      value: utxo.value,
      vout: utxo.tx_pos
    }))
  }
}

async function fetchElectrumSnapshot(
  url: string,
  network: Network,
  address: string,
  knownTxs: Transaction[],
  onProgress: AddressSyncProgress
) {
  const electrum = ElectrumClient.fromUrl(url, network)
  try {
    await electrum.init()
    return await readElectrumSnapshot(electrum, address, knownTxs, onProgress)
  } finally {
    closeElectrumClientQuietly(electrum)
  }
}

/**
 * Fetches one address' history and unspent set from the configured backend.
 * `knownTxs` are the account's stored transactions: only new ones are
 * downloaded, and known ones whose block changed come back moved to it.
 * Bitcoin Core RPC has no per-address lookup without a watching wallet, so
 * RPC-backed accounts sync through the BDK wallet path instead.
 */
export function fetchAddressSnapshot(
  server: Pick<Server, 'backend' | 'network' | 'url'>,
  address: string,
  knownTxs: Transaction[],
  onProgress: AddressSyncProgress
): Promise<AddressSnapshot> {
  if (server.backend === 'esplora') {
    return fetchEsploraSnapshot(server.url, address, knownTxs, onProgress)
  }
  if (server.backend === 'electrum') {
    return fetchElectrumSnapshot(
      server.url,
      server.network,
      address,
      knownTxs,
      onProgress
    )
  }
  throw new Error(`Address sync does not support the ${server.backend} backend`)
}
