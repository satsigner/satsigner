import { parseHexToBytes } from '@/utils/parse'

export type EsploraTx = {
  txid: string
  version: number
  locktime: number
  vin: {
    txid: string
    vout: number
    prevout: {
      scriptpubkey: string
      scriptpubkey_asm: string
      scriptpubkey_type: string
      scriptpubkey_address: string
      value: number
    }
    scriptsig: string
    scriptsig_asm: string
    witness: string[]
    is_coinbase: boolean
    sequence: number
  }[]
  vout: {
    scriptpubkey: string
    scriptpubkey_asm: string
    scriptpubkey_type: string
    scriptpubkey_address: string
    value: number
  }[]
  size: number
  weight: number
  fee: number
  status: {
    confirmed: boolean
    block_height: number
    block_hash: string
    block_time: number
  }
}

export type EsploraUtxo = {
  txid: string
  vout: number
  status: {
    confirmed: boolean
    block_height?: number
    block_hash?: string
    block_time?: number
  }
  value: number
}

export default class Esplora {
  public esploraUrl: string

  constructor(url: string) {
    this.esploraUrl = url
  }

  async _call(params: string) {
    try {
      const response = await fetch(this.esploraUrl + params, {
        method: 'GET',
        cache: 'no-cache'
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
    } catch (error: any) {
      if (error.message && error.message.includes('InvalidCertificate')) {
        throw new Error(
          'TLS certificate validation failed. Please check the server configuration.'
        )
      }

      if (error.message && error.message.includes('ConnectionFailed')) {
        throw new Error(
          'Connection failed. Please check your internet connection and server URL.'
        )
      }

      if (
        error.message &&
        (error.message.includes('NetworkError') ||
          error.message.includes('fetch'))
      ) {
        throw new Error('Network error. Please check your internet connection.')
      }

      throw new Error(error.message || 'Unknown error occurred')
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
    // Suppress console warnings during test
    // eslint-disable-next-line no-console
    const originalConsoleWarn = console.warn
    // eslint-disable-next-line no-console
    const originalConsoleError = console.error
    // eslint-disable-next-line no-console
    console.warn = () => {}
    // eslint-disable-next-line no-console
    console.error = () => {}

    const esploraClient = new Esplora(url)
    const fetchPromise = esploraClient.getLatestBlockHeight()
    const timeoutPromise = new Promise((resolve, reject) =>
      setTimeout(() => {
        reject(new Error('timeout'))
      }, timeout)
    )
    try {
      const result = await Promise.race([fetchPromise, timeoutPromise])
      if (result) {
        return true
      }
      return false
    } catch (error) {
      // Handle connection test failures with specific error messages
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error(
            'Connection timeout - server may be slow or unreachable'
          )
        } else if (error.message.includes('Unable to resolve host')) {
          throw new Error(
            'Unable to resolve host - check server URL and internet connection'
          )
        } else if (error.message.includes('ECONNREFUSED')) {
          throw new Error(
            'Connection refused - server may be down or port is closed'
          )
        } else if (error.message.includes('ENOTFOUND')) {
          throw new Error('Server not found - check the server URL')
        } else if (error.message.includes('InvalidCertificate')) {
          throw new Error(
            'TLS certificate validation failed - check server configuration'
          )
        } else if (error.message.includes('NetworkError')) {
          throw new Error('Network error - check your internet connection')
        } else {
          throw new Error(`Connection failed: ${error.message}`)
        }
      }
      throw new Error('Unknown connection error')
    } finally {
      // Restore console functions
      // eslint-disable-next-line no-console
      console.warn = originalConsoleWarn
      // eslint-disable-next-line no-console
      console.error = originalConsoleError
    }
  }
}
