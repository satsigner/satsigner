export interface EsploraTx {
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

export interface EsploraUtxo {
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

export class Esplora {
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
      throw new Error(error.message)
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

  async getAddressTx(address: string) {
    return await this._call('/address/' + address + '/txs')
  }

  async getAddressTxInMempool(address: string) {
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
}
