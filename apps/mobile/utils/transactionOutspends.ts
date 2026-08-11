import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import { type Server } from '@/types/settings/blockchain'

export type TransactionOutspend = {
  spent: boolean
  spendingTxId?: string
}

type OutspendOutput = {
  address: string
  vout: number
}

/**
 * Query the configured backend for whether each tx output is still unspent.
 * Used after the Sankey chart paints to replace “?” placeholders.
 */
function fetchTransactionOutspends(
  server: Server,
  txid: string,
  outputs: OutspendOutput[]
): Promise<Map<number, TransactionOutspend>> {
  if (outputs.length === 0) {
    return Promise.resolve(new Map())
  }

  if (server.backend === 'esplora') {
    return fetchEsploraOutspends(server.url, txid, outputs)
  }

  if (server.backend === 'rpc') {
    return fetchRpcOutspends(server, txid, outputs)
  }

  return fetchElectrumOutspends(server, txid, outputs)
}

async function fetchEsploraOutspends(
  url: string,
  txid: string,
  outputs: OutspendOutput[]
): Promise<Map<number, TransactionOutspend>> {
  const client = new Esplora(url)
  const outspends = await client.getTxOutspends(txid)
  const result = new Map<number, TransactionOutspend>()

  for (const output of outputs) {
    const entry = outspends[output.vout]
    if (!entry) {
      continue
    }
    result.set(output.vout, {
      spendingTxId: entry.txid?.trim() || undefined,
      spent: entry.spent
    })
  }

  return result
}

async function fetchRpcOutspends(
  server: Server,
  txid: string,
  outputs: OutspendOutput[]
): Promise<Map<number, TransactionOutspend>> {
  const rpc = new BitcoinRpc(
    server.url,
    server.rpcCredentials?.username ?? '',
    server.rpcCredentials?.password ?? ''
  )
  const result = new Map<number, TransactionOutspend>()

  await Promise.all(
    outputs.map(async (output) => {
      const utxo = await rpc.getTxOut(txid, output.vout)
      result.set(output.vout, { spent: utxo === null })
    })
  )

  return result
}

async function fetchElectrumOutspends(
  server: Server,
  txid: string,
  outputs: OutspendOutput[]
): Promise<Map<number, TransactionOutspend>> {
  const client = await ElectrumClient.initClientFromUrl(
    server.url,
    server.network
  )

  try {
    const byAddress = new Map<string, OutspendOutput[]>()
    for (const output of outputs) {
      const address = output.address.trim()
      if (!address) {
        continue
      }
      const list = byAddress.get(address) ?? []
      list.push(output)
      byAddress.set(address, list)
    }

    const unspentKeys = new Set<string>()
    await Promise.all(
      [...byAddress.keys()].map(async (address) => {
        const utxos = await client.getAddressUtxos(address)
        for (const utxo of utxos) {
          unspentKeys.add(`${utxo.tx_hash}:${utxo.tx_pos}`)
        }
      })
    )

    const result = new Map<number, TransactionOutspend>()
    for (const output of outputs) {
      const outpoint = `${txid}:${output.vout}`
      result.set(output.vout, {
        spent: !unspentKeys.has(outpoint)
      })
    }
    return result
  } finally {
    client.close()
  }
}

export { fetchTransactionOutspends }
