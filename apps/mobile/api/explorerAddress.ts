import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import type { ExplorerAddressData } from '@/types/explorer/address'
import type {
  Backend,
  Network,
  RpcCredentials
} from '@/types/settings/blockchain'

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
  const esplora = new Esplora(url)
  const [utxos, txs] = await Promise.all([
    esplora.getAddressUtxos(address),
    esplora.getAddressTxs(address)
  ])
  const confirmed = utxos
    .filter((utxo) => utxo.status.confirmed)
    .reduce((sum, utxo) => sum + utxo.value, 0)
  const unconfirmed = utxos
    .filter((utxo) => !utxo.status.confirmed)
    .reduce((sum, utxo) => sum + utxo.value, 0)

  return {
    address,
    confirmed,
    source: 'backend',
    txids: txs.map((tx) => tx.txid),
    unconfirmed,
    utxos: utxos.map((utxo) => ({
      height: utxo.status.block_height,
      txid: utxo.txid,
      value: utxo.value,
      vout: utxo.vout
    }))
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
  oracle: Pick<MempoolOracle, 'get' | 'getAddressUtxos'>
): Promise<ExplorerAddressData> {
  const [utxos, txsRaw] = await Promise.all([
    oracle.getAddressUtxos(address),
    oracle.get(`/address/${address}/txs`)
  ])

  const confirmed = utxos
    .filter((utxo) => utxo.status.confirmed)
    .reduce((sum, utxo) => sum + utxo.value, 0)
  const unconfirmed = utxos
    .filter((utxo) => !utxo.status.confirmed)
    .reduce((sum, utxo) => sum + utxo.value, 0)

  const txids = Array.isArray(txsRaw)
    ? txsRaw
        .map((tx) =>
          tx &&
          typeof tx === 'object' &&
          'txid' in tx &&
          typeof tx.txid === 'string'
            ? tx.txid
            : null
        )
        .filter((txid): txid is string => txid !== null)
    : []

  return {
    address,
    confirmed,
    source: 'mempool',
    txids,
    unconfirmed,
    utxos: utxos.map((utxo) => ({
      height: utxo.status.block_height,
      txid: utxo.txid,
      value: utxo.value,
      vout: utxo.vout
    }))
  }
}

export function emptyExplorerAddress(address: string): ExplorerAddressData {
  return emptyAddress(address)
}
