import z from 'zod'

import {
  ESPLORA_ADDRESS_TXS_PER_REQUEST,
  ESPLORA_ERROR_MESSAGES
} from '@/constants/esplora'
import { BlockSchema, BlockStatusSchema } from '@/types/models/Blockchain'
import {
  EsploraTxOutspendsSchema,
  EsploraTxSchema,
  EsploraUtxoSchema
} from '@/types/models/Esplora'
import { parseHexToBytes } from '@/utils/parse'

const parseBlocks = z.array(BlockSchema).parse
const parseTxs = z.array(EsploraTxSchema).parse
const parseTxIds = z.array(EsploraTxSchema.shape.txid).parse

export default class Esplora {
  public esploraUrl: string

  constructor(url: string) {
    this.esploraUrl = url
  }

  async _call(params: string, method: 'GET' | 'POST' = 'GET', body?: string) {
    try {
      const response = await fetch(this.esploraUrl + params, {
        ...(method !== 'GET' && body !== undefined ? { body } : {}),
        cache: 'no-cache',
        headers: {
          'Content-Type': 'text/plain'
        },
        method
      })

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      const contentType = response.headers.get('Content-Type') || ''
      if (contentType.includes('application/json')) {
        return await response.json()
      }
      if (contentType.includes('application/octet-stream')) {
        return await response.arrayBuffer()
      }
      return await response.text()
    } catch (error) {
      throw new Error(getVerboseErrorMessage(error), { cause: error })
    }
  }

  async getTxInfo(txid: string) {
    const data = await this._call(`/tx/${txid}`)
    return EsploraTxSchema.parse(data)
  }

  async getTxStatus(txid: string) {
    const data = await this._call(`/tx/${txid}/status`)
    return EsploraTxSchema.shape.status.parse(data)
  }

  async getBlockTxids(hash: string): Promise<string[]> {
    const data = await this._call(`/block/${hash}/txids`)
    return z.array(EsploraTxSchema.shape.txid).parse(data)
  }

  async getTxHex(txid: string) {
    const data = await this._call(`/tx/${txid}/hex`)
    return z.string().parse(data)
  }

  async getTxRaw(txid: string) {
    const data = await this._call(`/tx/${txid}/raw`)
    // TODO: verify is data binary content? unclear for now
    return data
  }

  async broadcastTransaction(txHex: string): Promise<string> {
    const data = await this._call('/tx', 'POST', txHex)
    return z.string().parse(data)
  }

  async getTxInputValues(txid: string) {
    const txInfo = await this.getTxInfo(txid)
    return txInfo.vin.map((input) => ({
      previousOutput: {
        txid: input.txid,
        vout: input.vout
      },
      scriptSig: parseHexToBytes(input.scriptsig),
      sequence: input.sequence,
      value: input.prevout?.value,
      witness: input.witness?.map(parseHexToBytes)
    }))
  }

  async getTxOutspends(txid: string) {
    const data = await this._call(`/tx/${txid}/outspends`)
    return EsploraTxOutspendsSchema.parse(data)
  }

  async getBlockInfo(blockHash: string) {
    const data = await this._call(`/block/${blockHash}`)
    return BlockSchema.parse(data)
  }

  async getBlockStatus(blockHash: string) {
    const data = await this._call(`/block/${blockHash}/status`)
    return BlockStatusSchema.parse(data)
  }

  async getBlockTransactions(blockHash: string, startIndex = 0) {
    const data = await this._call(`/block/${blockHash}/txs/${startIndex}`)
    return parseTxs(data)
  }

  async getBlockTransactionIds(blockHash: string) {
    const data = await this._call(`/block/${blockHash}/txids`)
    return parseTxIds(data)
  }

  async getBlockAtHeight(height: number) {
    const data = await this._call(`/block-height/${height}`)
    return BlockSchema.shape.id.parse(data)
  }

  async getLatestBlockHash() {
    const data = await this._call('/blocks/tip/hash')
    return BlockSchema.shape.id.parse(data)
  }

  async getLatestBlockHeight() {
    const data = await this._call('/blocks/tip/height')
    return Number(data)
  }

  async getBlocks(startHeight: number) {
    const data = await this._call(`/blocks/${startHeight}`)
    return parseBlocks(data)
  }

  async getAddressTxs(address: string, stopAtTxids?: Set<string>) {
    const endpoint = `/address/${address}/txs`
    const data = await this._call(endpoint)
    const transactions = parseTxs(data)

    let lastRequestTransactions = transactions
    while (lastRequestTransactions.length >= ESPLORA_ADDRESS_TXS_PER_REQUEST) {
      // Early stop: if every txid on this page is already known, no need to paginate further
      if (
        stopAtTxids &&
        lastRequestTransactions.every((tx) => stopAtTxids.has(tx.txid))
      ) {
        break
      }

      const lastTxId = transactions.at(-1)!.txid
      const data = await this._call(
        `/address/${address}/txs?after_txid=${lastTxId}`
      )
      const nextPageTransactions = parseTxs(data)
      lastRequestTransactions = nextPageTransactions
      transactions.push(...nextPageTransactions)
    }

    return transactions
  }

  async getAddressTxsInMempool(address: string) {
    const data = await this._call(`/address/${address}/txs/mempool`)
    return parseTxs(data)
  }

  async getAddressUtxos(address: string) {
    const data = await this._call(`/address/${address}/utxo`)
    return z.array(EsploraUtxoSchema).parse(data)
  }

  async getMempoolInfo() {
    return await this._call('/mempool')
  }

  async getMempoolTxIds() {
    return await this._call('/mempool/txids')
  }

  async getRecentMempool() {
    return await this._call('/mempool/recent')
  }

  async getFeeEstimates() {
    return await this._call('/fee-estimates')
  }

  // test connection
  static async test(url: string, timeout: number) {
    const esploraClient = new Esplora(url)
    const fetchPromise = esploraClient.getLatestBlockHeight()
    const timeoutPromise = new Promise((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error('timeout'))
      }, timeout)
    })

    try {
      const result = await Promise.race([fetchPromise, timeoutPromise])
      if (result !== null && result !== undefined && result !== '') {
        return true
      }
      return false
    } catch (error) {
      throw new Error(getVerboseErrorMessage(error), { cause: error })
    }
  }
}

function getVerboseErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unkown error'
  }
  for (const errorType of ESPLORA_ERROR_MESSAGES) {
    if (error.message.match(errorType.error)) {
      return errorType.reason
    }
  }
  return error.message
}
