import type { EsploraTx, EsploraUtxo } from '@/types/models/Esplora'
import { parseHexToBytes } from '@/utils/parse'

export default class Esplora {
  public esploraUrl: string

  constructor(url: string) {
    this.esploraUrl = url
  }

  async _call(params: string, method: 'GET' | 'POST' = 'GET', body?: string) {
    try {
      const response = await fetch(this.esploraUrl + params, {
        method,
        cache: 'no-cache',
        headers: {
          'Content-Type': 'text/plain'
        },
        body
      })
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      const contentType = response.headers.get('Content-Type') || ''

      // Handle different content types
      if (contentType.includes('application/json')) {
        return await response.json()
      } else if (contentType.includes('text/')) {
        return await response.text()
      } else if (contentType.includes('application/octet-stream')) {
        return await response.arrayBuffer() // For binary data
      } else {
        throw new Error(`Unsupported Content-Type: ${contentType}`)
      }
    } catch (e) {
      throw new Error(getVerboseErrorMessage(e))
    }
  }

  async getTxInfo(txid: string) {
    return (await this._call('/tx/' + txid)) as EsploraTx
  }

  async getTxStatus(txid: string) {
    return await this._call('/tx/' + txid + '/status')
  }

  async getBlockTxids(hash: string): Promise<any> {
    return await this._call('/block/' + hash + '/txids')
  }

  async getTxHex(txid: string) {
    return await this._call('/tx/' + txid + '/hex')
  }

  async getTxRaw(txid: string) {
    return await this._call('/tx/' + txid + '/raw')
  }

  async broadcastTransaction(txHex: string): Promise<string> {
    const result = await this._call('/tx', 'POST', txHex)
    return result as string
  }

  async getTxInputValues(txid: string) {
    return this.getTxInfo(txid).then((data) =>
      data.vin.map((input) => {
        return {
          previousOutput: {
            txid: input.txid,
            vout: input.vout
          },
          sequence: input.sequence,
          scriptSig: parseHexToBytes(input.scriptsig),
          value: input.prevout.value,
          witness: input.witness.map(parseHexToBytes)
        }
      })
    )
  }

  async getTxOutspends(txid: string) {
    return (await this._call('/tx/' + txid + '/outspends')) as {
      spent: boolean
    }[]
  }

  async getBlockInfo(blockHash: string) {
    return await this._call('/block/' + blockHash)
  }

  async getBlockStatus(blockHash: string) {
    return await this._call('/block/' + blockHash + '/status')
  }

  async getBlockTransactions(blockHash: string, startIndex: number = 0) {
    return await this._call('/block/' + blockHash + '/txs/' + startIndex)
  }

  async getBlockTransactionIds(blockHash: string) {
    return await this._call('/block/' + blockHash + '/txids')
  }

  async getBlockAtHeight(height: number) {
    return await this._call('/block-height/' + height)
  }

  async getLatestBlockHash() {
    return await this._call('/blocks/tip/hash')
  }

  async getLatestBlockHeight() {
    return await this._call('/blocks/tip/height')
  }

  async getBlocks(startHeight: number) {
    return await this._call('/blocks/' + startHeight)
  }

  async getAddressTxs(address: string) {
    const endpoint = `/address/${address}/txs`
    const transactions = (await this._call(endpoint)) as EsploraTx[]

    // if there are more than 50 transactions, we need to make multiple requests
    // due to the rate limit (at least for MemPool; we need to confirm it for
    // other instances).
    const perPage = 50
    let transactionCountLastFetchedPage = transactions.length
    while (transactionCountLastFetchedPage >= perPage) {
      const lastTxId = transactions[transactions.length - 1].txid
      const endpoint = `/address/${address}/txs?after_txid=${lastTxId}`
      const transactionsCurrentPage = (await this._call(
        endpoint
      )) as EsploraTx[]
      transactionCountLastFetchedPage = transactionsCurrentPage.length
      transactions.push(...transactionsCurrentPage)
    }

    return transactions
  }

  async getAddressTxsInMempool(address: string) {
    return (await this._call(
      '/address/' + address + '/txs/mempool'
    )) as EsploraTx[]
  }

  async getAddressUtxos(address: string): Promise<EsploraUtxo[]> {
    return await this._call('/address/' + address + '/utxo')
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

  static async test(url: string, timeout: number) {
    const esploraClient = new Esplora(url)
    const fetchPromise = esploraClient.getLatestBlockHeight
    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => {
        reject(new Error('timeout'))
      }, timeout)
    )

    try {
      const result = await Promise.race([fetchPromise, timeoutPromise])
      if (result) return true
      return false
    } catch (e) {
      throw new Error(getVerboseErrorMessage(e))
    }
  }
}

const verboseErrorMessages = [
  {
    error: 'timeout',
    reason: 'Connection timeout - server may be slow or unreachable'
  },
  {
    error: 'Unable to resolve host',
    reason: 'Unable to resolve host - check server URL and internet connection'
  },
  {
    error: 'ECONNREFUSED',
    reason: 'Connection refused - server may be down or port is closed'
  },
  {
    error: 'ENOTFOUND',
    reason: 'Server not found - check the server URL'
  },
  {
    error: 'InvalidCertificate',
    reason: 'TLS certificate validation failed - check server configuration'
  },
  {
    error: 'NetworkError',
    reason: 'Network error - check your internet connection'
  }
]

function getVerboseErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Unkown error'
  for (const errorType of verboseErrorMessages) {
    if (error.message.match(errorType.error)) {
      return errorType.reason
    }
  }
  return error.message
}
