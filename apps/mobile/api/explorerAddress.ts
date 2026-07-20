import z from 'zod'

import { type MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { ESPLORA_ADDRESS_TXS_PER_REQUEST } from '@/constants/esplora'
import type {
  ExplorerAddressData,
  ExplorerAddressUtxo
} from '@/types/explorer/address'
import { EsploraTxSchema } from '@/types/models/Esplora'
import type { Transaction } from '@/types/models/Transaction'
import type {
  Backend,
  Network,
  RpcCredentials
} from '@/types/settings/blockchain'
import { mapEsploraTxToAddressTransaction } from '@/utils/explorerAddressTx'

type AddressStats = {
  funded_txo_sum: number
  spent_txo_sum: number
}

function emptyAddress(address: string): ExplorerAddressData {
  return {
    address,
    confirmed: 0,
    source: 'backend',
    txids: [],
    unconfirmed: 0,
    utxos: []
  }
}

function balanceFromStats(stats: AddressStats | undefined): number {
  if (!stats) {
    return 0
  }
  return Math.max(0, stats.funded_txo_sum - stats.spent_txo_sum)
}

function parseAddressBalances(raw: unknown): {
  confirmed: number
  unconfirmed: number
} {
  if (!raw || typeof raw !== 'object') {
    return { confirmed: 0, unconfirmed: 0 }
  }

  const chain =
    'chain_stats' in raw &&
    raw.chain_stats &&
    typeof raw.chain_stats === 'object'
      ? (raw.chain_stats as AddressStats)
      : undefined
  const mempool =
    'mempool_stats' in raw &&
    raw.mempool_stats &&
    typeof raw.mempool_stats === 'object'
      ? (raw.mempool_stats as AddressStats)
      : undefined

  return {
    confirmed: balanceFromStats(chain),
    unconfirmed: balanceFromStats(mempool)
  }
}

function extractTxids(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((tx) =>
      tx &&
      typeof tx === 'object' &&
      'txid' in tx &&
      typeof tx.txid === 'string'
        ? tx.txid
        : null
    )
    .filter((txid): txid is string => txid !== null)
}

async function fetchAddressSummary(
  url: string,
  address: string
): Promise<{ confirmed: number; unconfirmed: number }> {
  const esplora = new Esplora(url)
  const raw = await esplora.getAddress(address)
  return parseAddressBalances(raw)
}

async function fetchRecentTxids(
  url: string,
  address: string
): Promise<string[]> {
  const esplora = new Esplora(url)
  // First page only — full history can be tens of thousands of txs.
  const raw = await esplora.getAddressTxsPage(address)
  return extractTxids(raw)
}

async function fetchUtxosBestEffort(
  url: string,
  address: string
): Promise<ExplorerAddressUtxo[]> {
  try {
    const esplora = new Esplora(url)
    const utxos = await esplora.getAddressUtxos(address)
    return utxos.map((utxo) => ({
      height: utxo.status.block_height,
      txid: utxo.txid,
      value: utxo.value,
      vout: utxo.vout
    }))
  } catch {
    // Mempool/Esplora reject addresses with >500 UTXOs.
    return []
  }
}

async function fromElectrum(
  address: string,
  url: string,
  network: Network
): Promise<ExplorerAddressData> {
  const client = ElectrumClient.fromUrl(url, network)
  try {
    await client.init()
    const [balance, utxos, txs] = await Promise.all([
      client.getAddressBalance(address),
      client.getAddressUtxos(address),
      client.getAddressTransactions(address)
    ])
    return {
      address,
      confirmed: balance.confirmed,
      source: 'backend',
      txids: txs.map((tx) => tx.tx_hash),
      unconfirmed: balance.unconfirmed,
      utxos: utxos.map((utxo) => ({
        height: utxo.height,
        txid: utxo.tx_hash,
        value: utxo.value,
        vout: utxo.tx_pos
      }))
    }
  } finally {
    client.close()
  }
}

async function fromEsplora(
  address: string,
  url: string
): Promise<ExplorerAddressData> {
  const [balances, txids, utxos] = await Promise.all([
    fetchAddressSummary(url, address),
    fetchRecentTxids(url, address).catch(() => [] as string[]),
    fetchUtxosBestEffort(url, address)
  ])

  return {
    address,
    confirmed: balances.confirmed,
    source: 'backend',
    txids,
    unconfirmed: balances.unconfirmed,
    utxos
  }
}

export function fetchExplorerAddressFromBackend(
  address: string,
  url: string,
  backend: Backend,
  network: Network,
  _rpcCredentials?: RpcCredentials
): Promise<ExplorerAddressData> {
  if (backend === 'electrum') {
    return fromElectrum(address, url, network)
  }
  if (backend === 'esplora') {
    return fromEsplora(address, url)
  }
  return Promise.reject(new Error('rpc_unsupported'))
}

export async function fetchExplorerAddressFromMempool(
  address: string,
  oracle: Pick<MempoolOracle, 'baseUrl'>
): Promise<ExplorerAddressData> {
  const url = oracle.baseUrl
  const [balances, txids, utxos] = await Promise.all([
    fetchAddressSummary(url, address),
    fetchRecentTxids(url, address).catch(() => [] as string[]),
    fetchUtxosBestEffort(url, address)
  ])

  return {
    address,
    confirmed: balances.confirmed,
    source: 'mempool',
    txids,
    unconfirmed: balances.unconfirmed,
    utxos
  }
}

export function emptyExplorerAddress(address: string): ExplorerAddressData {
  return emptyAddress(address)
}

async function fetchEsploraAddressTxDetails(
  url: string,
  address: string
): Promise<Transaction[]> {
  const esplora = new Esplora(url)
  const raw = await esplora.getAddressTxsPage(address)
  const txs = z.array(EsploraTxSchema).parse(raw)
  return txs.map((tx) => mapEsploraTxToAddressTransaction(tx, address))
}

async function fetchElectrumAddressTxDetails(
  address: string,
  url: string,
  network: Network,
  txids: string[]
): Promise<Transaction[]> {
  const client = ElectrumClient.fromUrl(url, network)
  try {
    await client.init()
    const limitedTxids = txids.slice(0, ESPLORA_ADDRESS_TXS_PER_REQUEST)
    if (limitedTxids.length === 0) {
      return []
    }

    const history = await client.getAddressTransactions(address)
    const heightByTxid = new Map(
      history.map((entry) => [entry.tx_hash, entry.height] as const)
    )
    const rawTransactions = await client.getTransactions(limitedTxids)
    const heights = limitedTxids.map((txid) => heightByTxid.get(txid) ?? 0)
    const timestamps = await client.getBlockTimestamps(heights)
    return client.parseAddressTransactions(
      address,
      rawTransactions,
      heights,
      timestamps
    )
  } finally {
    client.close()
  }
}

export function fetchExplorerAddressTxDetailsFromBackend(
  address: string,
  url: string,
  backend: Backend,
  network: Network,
  txids: string[]
): Promise<Transaction[]> {
  if (backend === 'esplora') {
    return fetchEsploraAddressTxDetails(url, address)
  }
  if (backend === 'electrum') {
    return fetchElectrumAddressTxDetails(address, url, network, txids)
  }
  return Promise.reject(new Error('rpc_unsupported'))
}

export function fetchExplorerAddressTxDetailsFromMempool(
  address: string,
  oracle: Pick<MempoolOracle, 'baseUrl'>
): Promise<Transaction[]> {
  return fetchEsploraAddressTxDetails(oracle.baseUrl, address)
}
