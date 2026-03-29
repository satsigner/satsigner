import * as bitcoinjs from 'bitcoinjs-lib'
import BlueWalletElectrumClient from 'electrum-client'
import TcpSocket from 'react-native-tcp-socket'

import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Network } from '@/types/settings/blockchain'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { parseHexToBytes } from '@/utils/parse'
import { bytesToHex } from '@/utils/scripts'
import { time } from '@/utils/time'
import { TxDecoded } from '@/utils/txDecoded'
import { isValidDomainName, isValidIPAddress } from '@/utils/validation/url'

type IElectrumClient = {
  props: {
    host: string
    port: number
    protocol?: 'tcp' | 'tls' | 'ssl'
    network?: Network
  }
  addressBalance: {
    confirmed: number
    unconfirmed: number
  }
  addressTxs: {
    height: number
    tx_hash: string
  }[]
  addressUtxos: {
    height: number
    tx_hash: string
    tx_pos: number
    value: number
  }[]
  addressUnconfirmed: {
    height: number
    tx_hash: string
    fee: number
  }[]
  transactionRaw: {
    id: string
    jsonrpc: string
    param: string
    result: string
  }
  transaction: {
    blockhash: string
    blocktime: number
    confirmations: number
    hash: string
    hex: string
    locktime: number
    size: number
    time: number
    txid: string
    version: number
    vin: {
      scriptSig: {
        asm: string
        hex: string
      }
      sequence: number
      txid: string
      vout: number
    }[]
    vout: {
      n: number
      scriptPubkey: {
        addresses: string[]
        asm: string
        hex: string
        reqSigs: number
        type: string
      }
      value: string
    }[]
  }
}

type AddressInfo = {
  transactions: Transaction[]
  utxos: Utxo[]
  balance: {
    confirmed: number
    unconfirmed: number
  }
}

class ModifiedClient extends BlueWalletElectrumClient {
  // INFO: Override the default timeout for keeping client alive
  keepAlive() {
    if (this.timeout !== null && this.timeout !== undefined) {
      clearTimeout(this.timeout)
    }
    const now = time.now()
    this.timeout = setTimeout(() => {
      if (this.timeLastCall !== 0 && now > this.timeLastCall + 500_000) {
        const pingTimer = setTimeout(() => {
          this.onError(new Error('keepalive ping timeout'))
        }, 900_000)

        this.server_ping()
          .catch(() => {
            clearTimeout(pingTimer)
          })
          .then(() => clearTimeout(pingTimer))
      }
    }, 50_000)
  }
}

class BaseElectrumClient {
  client: ModifiedClient
  network: bitcoinjs.networks.Network

  constructor({
    host,
    port,
    protocol = 'ssl',
    network = 'signet'
  }: IElectrumClient['props']) {
    const net = TcpSocket
    const tls = TcpSocket
    const options = {}

    this.client = new ModifiedClient(net, tls, port, host, protocol, options)
    this.network = bitcoinjsNetwork(network)
  }

  static fromUrl(url: string, network: Network): ElectrumClient {
    const port = url.replace(/.*:/, '')
    const protocol = url.replace(/:\/\/.*/, '')
    const host = url.replace(`${protocol}://`, '').replace(`:${port}`, '')

    // Validate host: allow domain names (including .onion), IP addresses
    const isValidDomain = isValidDomainName(host)
    const isValidIP = isValidIPAddress(host)

    if (
      !(isValidDomain || isValidIP) ||
      !port.match(/^[0-9]+$/) ||
      (protocol !== 'ssl' && protocol !== 'tls' && protocol !== 'tcp')
    ) {
      throw new Error('Invalid backend URL')
    }

    const client = new ElectrumClient({
      host,
      network,
      port: Number(port),
      protocol
    })
    return client
  }

  static async initClientFromUrl(
    url: string,
    network: Network = 'bitcoin'
  ): Promise<ElectrumClient> {
    const client = ElectrumClient.fromUrl(url, network)
    await client.init()
    return client
  }

  static async test(url: string, network: Network, timeout: number) {
    let client: ElectrumClient | null = null
    let timeoutId: NodeJS.Timeout | null = null

    try {
      client = ElectrumClient.fromUrl(url, network)

      // The library sets socket.setTimeout(5000) which fires silently after 5s
      // of inactivity. On physical devices over WiFi the TLS handshake can
      // take longer, so we disable the library's timer entirely and rely on
      // our outer JS timeout instead.
      const { conn } = client.client as unknown as {
        conn?: { setTimeout?: (ms: number) => void }
      }
      if (conn && typeof conn.setTimeout === 'function') {
        conn.setTimeout(0)
      }

      const pingPromise = client.client.initElectrum(
        { client: 'satsigner', version: '1.4' },
        { callback: null, maxRetry: 0 }
      )

      const timeoutPromise = new Promise((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`timeout after ${timeout}ms`))
        }, timeout)
      })

      await Promise.race([pingPromise, timeoutPromise])

      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      return true
    } catch {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      return false
    } finally {
      try {
        client?.close()
      } catch {
        /* silently ignored */
      }
    }
  }

  async init() {
    // maxRetry: 0 disables the library's built-in reconnect loop.
    // The library's reconnect() resets maxRetry to 1000 on every call,
    // creating an unbounded loop that leaks a new OS thread per attempt
    // and causes pthread_create OOM on Android.
    //
    // Disable the library's 5s socket inactivity timer — on physical devices
    // over WiFi the TLS handshake can exceed 5s, and letting the timer fire
    // silently (or worse, destroying the socket) causes spurious failures.
    const { conn } = this.client as unknown as {
      conn?: { setTimeout?: (ms: number) => void }
    }
    if (conn && typeof conn.setTimeout === 'function') {
      conn.setTimeout(0)
    }
    await this.client.initElectrum(
      { client: 'satsigner', version: '1.4' },
      { callback: null, maxRetry: 0 }
    )
  }

  close() {
    this.client.close()
  }

  reconnect() {
    this.client.reconnect()
  }

  addressToScriptHash(address: string) {
    const { network } = this
    const script = bitcoinjs.address.toOutputScript(address, network)
    const hash = bitcoinjs.crypto.sha256(script)
    const reversedHash = new Buffer(hash.reverse())
    const scriptHash = reversedHash.toString('hex')
    return scriptHash
  }

  async getAddressBalance(
    address: string
  ): Promise<IElectrumClient['addressBalance']> {
    const scriptHash = this.addressToScriptHash(address)
    const balance =
      await this.client.blockchainScripthash_getBalance(scriptHash)
    return balance
  }

  async getAddressUtxos(
    address: string
  ): Promise<IElectrumClient['addressUtxos']> {
    const scriptHash = this.addressToScriptHash(address)
    const result =
      await this.client.blockchainScripthash_listunspent(scriptHash)
    return result
  }

  async getAddressTransactions(
    address: string
  ): Promise<IElectrumClient['addressTxs']> {
    const scriptHash = this.addressToScriptHash(address)
    const result = await this.client.blockchainScripthash_getHistory(scriptHash)
    return result
  }

  async getAddressUnconfirmed(
    address: string
  ): Promise<IElectrumClient['addressUnconfirmed']> {
    const scriptHash = this.addressToScriptHash(address)
    const result = await this.client.blockchainScripthash_getMempool(scriptHash)
    return result
  }

  async getTransaction(txid: string, verbose = false): Promise<string> {
    const txRaw = await this.client.blockchainTransaction_get(txid, verbose)
    return txRaw
  }

  async getTransactions(txIds: string[]): Promise<string[]> {
    const verbose = false // verbose=true is not supported by some clients
    const rawTxs = []
    for (const txid of txIds) {
      const raw = await this.client.blockchainTransaction_get(txid, verbose)
      rawTxs.push(raw)
    }
    return rawTxs
  }
}

class ElectrumClient extends BaseElectrumClient {
  async getAddressInfo(
    address: string,
    addressKeychain: Utxo['keychain'] = 'external'
  ): Promise<AddressInfo> {
    const addressUtxos = await super.getAddressUtxos(address)
    const utxoHeights = addressUtxos.map((value) => value.height)
    const utxoTimestamps = await this.getBlockTimestamps(utxoHeights)
    const utxos: Utxo[] = this.parseAddressUtxos(
      address,
      addressUtxos,
      utxoTimestamps,
      addressKeychain
    )

    const addressTxs = await super.getAddressTransactions(address)
    const txIds = addressTxs.map((value) => value.tx_hash)
    const rawTransactions = await this.getTransactions(txIds)
    const txHeights = addressTxs.map((value) => value.height)
    const txTimestamps = await this.getBlockTimestamps(txHeights)
    const balance = await this.getAddressBalance(address)
    const transactions = this.parseAddressTransactions(
      address,
      rawTransactions,
      txHeights,
      txTimestamps
    )

    return { balance, transactions, utxos }
  }

  async getBlock(height: number): Promise<bitcoinjs.Block> {
    const blockHeaderRaw = await this.client.blockchainBlock_header(height)
    const blockHeader = bitcoinjs.Block.fromHex(blockHeaderRaw)
    return blockHeader
  }

  subscribeToBlockHeaders(): Promise<{ height: number } | null> {
    const rawClient = this.client as unknown as {
      blockchainHeaders_subscribe: () => Promise<{ height: number } | null>
    }
    return rawClient.blockchainHeaders_subscribe()
  }

  async getMempoolFeeHistogram(): Promise<[number, number][]> {
    const rawClient = this.client as unknown as {
      mempool_get_fee_histogram?: () => Promise<[number, number][]>
    }
    const result = await rawClient.mempool_get_fee_histogram?.()
    return Array.isArray(result) ? result : []
  }

  async getBlockTimestamp(height: number): Promise<number> {
    const blockHeaderRaw = await this.client.blockchainBlock_header(height)
    const blockHeader = bitcoinjs.Block.fromHex(blockHeaderRaw)
    return blockHeader.timestamp
  }

  async getBlockTimestamps(heights: number[]): Promise<number[]> {
    const heightTimestampDict: Record<number, number> = {}
    const timestamps: number[] = []
    for (const height of heights) {
      if (!heightTimestampDict[height]) {
        heightTimestampDict[height] = await this.getBlockTimestamp(height)
      }
      timestamps.push(heightTimestampDict[height])
    }
    return timestamps
  }

  // Refactor to use only the TXID instead of the transaction?
  async getTxInputValues(tx: Transaction): Promise<Transaction['vin']> {
    const vin: Transaction['vin'] = []
    const txIds = tx.vin.map((input) => input.previousOutput.txid)
    const vouts = tx.vin.map((input) => input.previousOutput.vout)
    const previousTxsRaw = await this.getTransactions(txIds)
    for (let i = 0; i < tx.vin.length; i += 1) {
      const vout = vouts[i]
      const prevTx = bitcoinjs.Transaction.fromHex(previousTxsRaw[i])
      const { value } = prevTx.outs[vout]
      vin.push({
        ...tx.vin[i],
        value
      })
    }
    return vin
  }

  parseAddressUtxos(
    address: string,
    utxos: IElectrumClient['addressUtxos'],
    timestamps: number[],
    addressKeychain: string
  ): Utxo[] {
    return utxos.map((electrumUtxo, index) => ({
      addressTo: address,
      keychain: addressKeychain as Utxo['keychain'],
      label: '',
      script: [...bitcoinjs.address.toOutputScript(address, this.network)],
      timestamp: new Date(timestamps[index] * 1000),
      txid: electrumUtxo.tx_hash,
      value: electrumUtxo.value,
      vout: electrumUtxo.tx_pos
    }))
  }

  parseAddressTransactions(
    address: string,
    rawTransactions: string[],
    heights: number[],
    timestamps: number[]
  ): Transaction[] {
    const transactions: Transaction[] = []
    const { network } = this

    // this is used to look up the parent transaction of an input
    const parsedTransactions: TxDecoded[] = []
    const txDictionary: Record<string, number> = {}

    for (const [index, rawTx] of rawTransactions.entries()) {
      const parsedTx = TxDecoded.fromHex(rawTx)
      const tx: Transaction = {
        address,
        blockHeight: heights[index],
        id: parsedTx.getId(),
        label: '',
        lockTime: parsedTx.locktime,
        lockTimeEnabled: parsedTx.locktime > 0,
        prices: {},
        raw: parseHexToBytes(rawTx),
        received: 0,
        sent: 0,
        size: parsedTx.byteLength(),
        timestamp: new Date(timestamps[index] * 1000),
        type: 'send',
        version: parsedTx.version,
        vin: [],
        vout: [],
        vsize: parsedTx.virtualSize(),
        weight: parsedTx.weight()
      }

      transactions.push(tx)
      parsedTransactions.push(parsedTx)
      txDictionary[tx.id] = index
    }

    // Compute sent and received vales
    // Also, add the fields VINS && VOUTS to the transaction
    for (let i = 0; i < transactions.length; i += 1) {
      const currentTx = parsedTransactions[i]
      const outputCount = Number(currentTx.getOutputCount().value)
      const inputCount = Number(currentTx.getInputCount().value)

      for (let j = 0; j < outputCount; j += 1) {
        const addr = currentTx.generateOutputScriptAddress(j, network)
        const value = Number(currentTx.getOutputValue(j).value)
        const script = [...currentTx.outs[j].script]

        transactions[i].vout.push({ address: addr, script, value })

        // Compute received value by checking if tx outputs match address
        if (addr !== address) {
          continue
        }
        transactions[i].received += value
      }

      for (let j = 0; j < inputCount; j += 1) {
        const prevTxId = currentTx.getInputHash(j).value as string
        const vout = Number(currentTx.getInputIndex(j).value)
        const { sequence } = currentTx.ins[j]
        const witness = currentTx.ins[j].witness.map((w) => [...w])
        const scriptSig = [...currentTx.ins[j].script]

        transactions[i].vin?.push({
          previousOutput: {
            txid: prevTxId,
            vout
          },
          scriptSig,
          sequence,
          witness
        })

        if (txDictionary[prevTxId] === undefined) {
          continue
        }
        const prevTxIndex = txDictionary[prevTxId]
        const parentTx = parsedTransactions[prevTxIndex]
        const addr = parentTx.generateOutputScriptAddress(vout, network)

        // Compute sent value by checking if tx inputs match address
        if (addr !== address) {
          continue
        }
        const value = Number(parentTx.getOutputValue(vout).value)
        transactions[i].sent += value
      }

      transactions[i].type =
        transactions[i].received > transactions[i].sent ? 'receive' : 'send'
    }

    return transactions
  }

  parseAddressPartialTransactions(
    address: string,
    partialTransactions: Transaction[]
  ) {
    const transactions = [...partialTransactions]
    const txidToParsedTxIndex: Record<string, number> = {}
    const parsedTransactions: TxDecoded[] = []

    for (const tx of transactions) {
      const { id, raw } = tx
      if (!raw) {
        continue
      }
      const txHex = bytesToHex(raw)
      txidToParsedTxIndex[id] = parsedTransactions.length
      parsedTransactions.push(TxDecoded.fromHex(txHex))
    }

    // Compute sent and received vales
    // Also, add the fields VINS && VOUTS to the transaction
    for (let i = 0; i < transactions.length; i += 1) {
      if (transactions[i].raw === undefined) {
        continue
      }

      const txid = transactions[i].id
      const index = txidToParsedTxIndex[txid]
      const currentTx = parsedTransactions[index]
      const outputCount = Number(currentTx.getOutputCount().value)
      const inputCount = Number(currentTx.getInputCount().value)

      transactions[i] = {
        ...transactions[i],
        received: 0,
        sent: 0,
        vin: [],
        vout: []
      }

      for (let j = 0; j < outputCount; j += 1) {
        const addr = currentTx.generateOutputScriptAddress(j, this.network)
        const value = Number(currentTx.getOutputValue(j).value)
        const script = [...currentTx.outs[j].script]

        transactions[i].vout.push({ address: addr, script, value })

        // Compute received value by checking if tx outputs match address
        if (addr !== address) {
          continue
        }
        transactions[i].received += value
      }

      for (let j = 0; j < inputCount; j += 1) {
        const prevTxId = currentTx.getInputHash(j).value as string
        const vout = Number(currentTx.getInputIndex(j).value)
        const { sequence } = currentTx.ins[j]
        const witness = currentTx.ins[j].witness.map((w) => [...w])
        const scriptSig = [...currentTx.ins[j].script]

        transactions[i].vin?.push({
          previousOutput: {
            txid: prevTxId,
            vout
          },
          scriptSig,
          sequence,
          witness
        })

        if (txidToParsedTxIndex[prevTxId] === undefined) {
          continue
        }
        const prevTxIndex = txidToParsedTxIndex[prevTxId]
        const parentTx = parsedTransactions[prevTxIndex]
        const addr = parentTx.generateOutputScriptAddress(vout, this.network)

        // Compute sent value by checking if tx inputs match address
        if (addr !== address) {
          continue
        }
        const value = Number(parentTx.getOutputValue(vout).value)
        transactions[i].sent += value
      }

      transactions[i].type =
        transactions[i].received > transactions[i].sent ? 'receive' : 'send'
    }

    return transactions
  }

  async broadcastTransactionHex(rawTxHex: string): Promise<string> {
    // This uses the standard Electrum protocol method
    return await this.client.blockchainTransaction_broadcast(rawTxHex)
  }
}

export default ElectrumClient
