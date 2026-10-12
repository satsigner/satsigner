import { hex } from '@scure/base'
import * as bitcoinjs from 'bitcoinjs-lib'

import { type Transaction } from '@/types/models/Transaction'
import { type Network, type Server } from '@/types/settings/blockchain'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { getUtxoOutpoint } from '@/utils/outpoint'

import ElectrumClient from './electrum'
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

export type KnownAddressData = {
  transactions: Transaction[]
  outpoints: Set<string>
}

/** Reports work as deltas: tasks finished and tasks newly scheduled. */
export type AddressSyncProgress = (done: number, added: number) => void

function toDate(unixSeconds: number | undefined) {
  return unixSeconds ? new Date(unixSeconds * 1000) : undefined
}

async function fetchEsploraTxHexes(esplora: Esplora, txids: string[]) {
  const hexByTxid: Record<string, string> = {}
  for (let i = 0; i < txids.length; i += ESPLORA_TX_HEX_BATCH_SIZE) {
    const batch = txids.slice(i, i + ESPLORA_TX_HEX_BATCH_SIZE)
    const hexes = await Promise.all(batch.map((txid) => esplora.getTxHex(txid)))
    for (const [index, txid] of batch.entries()) {
      hexByTxid[txid] = hexes[index]
    }
  }
  return hexByTxid
}

async function fetchEsploraSnapshot(
  url: string,
  address: string,
  known: KnownAddressData,
  onProgress: AddressSyncProgress
): Promise<AddressSnapshot> {
  const esplora = new Esplora(url)
  const knownTxids = new Set(known.transactions.map((tx) => tx.id))

  onProgress(0, 2)
  // Stops paginating once a page holds only known txids.
  const esploraTxs = await esplora.getAddressTxs(address, knownTxids)
  const esploraUtxos = await esplora.getAddressUtxos(address)
  onProgress(2, 0)

  const newTxs = esploraTxs.filter((tx) => !knownTxids.has(tx.txid))
  onProgress(0, newTxs.length)
  const hexByTxid = await fetchEsploraTxHexes(
    esplora,
    newTxs.map((tx) => tx.txid)
  )

  const transactions = newTxs.map((t): Transaction => {
    const sent = t.vin
      .filter((input) => input.prevout?.scriptpubkey_address === address)
      .reduce((sum, input) => sum + (input.prevout?.value ?? 0), 0)
    const received = t.vout
      .filter((out) => out.scriptpubkey_address === address)
      .reduce((sum, out) => sum + out.value, 0)
    onProgress(1, 0)

    return {
      address,
      blockHeight: t.status.block_height,
      fee: t.fee,
      id: t.txid,
      label: '',
      lockTime: t.locktime,
      lockTimeEnabled: t.locktime > 0,
      prices: {},
      raw: Array.from(hex.decode(hexByTxid[t.txid])),
      received,
      sent,
      size: t.size,
      timestamp: toDate(t.status.block_time),
      type: received > 0 ? 'receive' : 'send',
      version: t.version,
      vin: t.vin.map((input) => ({
        previousOutput: { txid: input.txid, vout: input.vout },
        scriptSig: Array.from(hex.decode(input.scriptsig ?? '')),
        sequence: input.sequence,
        witness: (input.witness ?? []).map((w) => Array.from(hex.decode(w)))
      })),
      vout: t.vout.map((out) => ({
        address: out.scriptpubkey_address || '',
        script: out.scriptpubkey
          ? Array.from(hex.decode(out.scriptpubkey))
          : [],
        value: out.value
      })),
      weight: t.weight
    }
  })

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
    txids: esploraTxs.map((tx) => tx.txid),
    utxos: esploraUtxos.map((utxo) => ({
      timestamp: toDate(utxo.status.block_time),
      txid: utxo.txid,
      value: utxo.value,
      vout: utxo.vout
    }))
  }
}

function sumReceivedByAddress(
  rawTx: bitcoinjs.Transaction,
  address: string,
  network: Network
) {
  const addressScript = bitcoinjs.address.toOutputScript(
    address,
    bitcoinjsNetwork(network)
  )
  return rawTx.outs
    .filter((output) => output.script.equals(addressScript))
    .reduce((sum, output) => sum + output.value, 0)
}

async function readElectrumSnapshot(
  electrum: ElectrumClient,
  network: Network,
  address: string,
  known: KnownAddressData,
  onProgress: AddressSyncProgress
): Promise<AddressSnapshot> {
  onProgress(0, 3)
  const electrumUtxos = await electrum.getAddressUtxos(address)
  const electrumTxs = await electrum.getAddressTransactions(address)
  const balance = await electrum.getAddressBalance(address)
  onProgress(3, 0)

  const knownTxids = new Set(known.transactions.map((tx) => tx.id))
  const pendingTxs = electrumTxs.filter((tx) => !knownTxids.has(tx.tx_hash))
  const isPendingUtxo = (utxo: (typeof electrumUtxos)[number]) =>
    !known.outpoints.has(
      getUtxoOutpoint({ txid: utxo.tx_hash, vout: utxo.tx_pos })
    )
  const pendingUtxos = electrumUtxos.filter(isPendingUtxo)
  onProgress(0, pendingTxs.length * 2 + pendingUtxos.length)

  const timestampByHeight: Record<number, number> = {}
  async function blockTimestamp(height: number) {
    if (!timestampByHeight[height]) {
      timestampByHeight[height] = await electrum.getBlockTimestamp(height)
    }
    return timestampByHeight[height]
  }

  // Partial transactions: sent, vin and vout are filled in by
  // parseAddressPartialTransactions below.
  const partialTxs: Transaction[] = []
  for (const { tx_hash: txid, height } of pendingTxs) {
    const rawTx = await electrum.getTransactionRaw(txid)
    onProgress(1, 0)
    const timestamp = await blockTimestamp(height)
    onProgress(1, 0)

    const parsed = bitcoinjs.Transaction.fromHex(rawTx)
    const received = sumReceivedByAddress(parsed, address, network)
    partialTxs.push({
      address,
      blockHeight: height,
      id: parsed.getId(),
      label: '',
      lockTime: parsed.locktime,
      lockTimeEnabled: parsed.locktime > 0,
      prices: {},
      raw: Array.from(hex.decode(rawTx)),
      received,
      sent: 0,
      size: parsed.byteLength(),
      timestamp: new Date(timestamp * 1000),
      type: received > 0 ? 'receive' : 'send',
      version: parsed.version,
      vin: [],
      vout: [],
      vsize: parsed.virtualSize(),
      weight: parsed.weight()
    })
  }

  const addressTxids = new Set(electrumTxs.map((tx) => tx.tx_hash))
  // Known transactions are parsed again so `sent` can see parents fetched now.
  const transactions = electrum.parseAddressPartialTransactions(address, [
    ...known.transactions.filter((tx) => addressTxids.has(tx.id)),
    ...partialTxs
  ])

  // Known UTXOs keep their stored timestamp, so only new ones are looked up.
  const utxos: AddressSnapshotUtxo[] = []
  for (const utxo of electrumUtxos) {
    const timestamp = isPendingUtxo(utxo)
      ? await blockTimestamp(utxo.height)
      : undefined
    if (timestamp !== undefined) {
      onProgress(1, 0)
    }
    utxos.push({
      timestamp: toDate(timestamp),
      txid: utxo.tx_hash,
      value: utxo.value,
      vout: utxo.tx_pos
    })
  }

  return {
    balance,
    transactions,
    txids: electrumTxs.map((tx) => tx.tx_hash),
    utxos
  }
}

// A failed close must not turn a finished sync into an error.
function closeQuietly(electrum: ElectrumClient) {
  try {
    electrum.close()
  } catch {
    // the socket is already gone
  }
}

async function fetchElectrumSnapshot(
  url: string,
  network: Network,
  address: string,
  known: KnownAddressData,
  onProgress: AddressSyncProgress
) {
  const electrum = ElectrumClient.fromUrl(url, network)
  await electrum.init()
  try {
    return await readElectrumSnapshot(
      electrum,
      network,
      address,
      known,
      onProgress
    )
  } finally {
    closeQuietly(electrum)
  }
}

/**
 * Fetches one address' history and unspent set from the configured backend.
 * Bitcoin Core RPC has no per-address lookup without a watching wallet, so
 * RPC-backed accounts sync through the BDK wallet path instead.
 */
export function fetchAddressSnapshot(
  server: Pick<Server, 'backend' | 'network' | 'url'>,
  address: string,
  known: KnownAddressData,
  onProgress: AddressSyncProgress
): Promise<AddressSnapshot> {
  if (server.backend === 'esplora') {
    return fetchEsploraSnapshot(server.url, address, known, onProgress)
  }
  if (server.backend === 'electrum') {
    return fetchElectrumSnapshot(
      server.url,
      server.network,
      address,
      known,
      onProgress
    )
  }
  throw new Error(`Address sync does not support the ${server.backend} backend`)
}
