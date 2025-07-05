import * as bitcoinjs from 'bitcoinjs-lib'
// @ts-ignore @eslint-disable-next-line
import BlueWalletElectrumClient from 'electrum-client'
import TcpSocket from 'react-native-tcp-socket'

import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Network } from '@/types/settings/blockchain'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { parseHexToBytes } from '@/utils/parse'
import { bytesToHex } from '@/utils/scripts'
import { TxDecoded } from '@/utils/txDecoded'

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
    // @ts-ignore
    if (this.timeout != null) clearTimeout(this.timeout)
    const now = new Date().getTime()
    // @ts-ignore
    this.timeout = setTimeout(() => {
      // @ts-ignore
      if (this.timeLastCall !== 0 && now > this.timeLastCall + 500_000) {
        const pingTimer = setTimeout(() => {
          // @ts-ignore
          this.onError(new Error('keepalive ping timeout'))
        }, 900_000)

        // @ts-ignore
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
  client: any
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

    // @ts-ignore
    this.client = new ModifiedClient(net, tls, port, host, protocol, options)
    this.network = bitcoinjsNetwork(network)
  }

  static fromUrl(url: string, network: Network): ElectrumClient {
    const port = url.replace(/.*:/, '')
    const protocol = url.replace(/:\/\/.*/, '')
    const host = url.replace(`${protocol}://`, '').replace(`:${port}`, '')

    if (
      !host.match(/^[a-z][a-z.]+$/i) ||
      !port.match(/^[0-9]+$/) ||
      (protocol !== 'ssl' && protocol !== 'tls' && protocol !== 'tcp')
    ) {
      throw new Error('Invalid backend URL')
    }

    const client = new ElectrumClient({
      host,
      port: Number(port),
      protocol,
      network
    })
    return client
  }

  static async initClientFromUrl(
    url: string,
    network: Network
  ): Promise<ElectrumClient> {
    const client = ElectrumClient.fromUrl(url, network)
    await client.init()
    return client
  }

  static async test(url: string, network: Network, timeout: number) {
    const client = ElectrumClient.fromUrl(url, network)
    const pingPromise = client.client.initElectrum({
      client: 'satsigner',
      version: '1.4'
    })
    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => {
        reject(new Error('timeout'))
      }, timeout)
    )
    try {
      await Promise.race([pingPromise, timeoutPromise])
      return true
    } catch {
      return false
    } finally {
      client.close()
    }
  }

  async init() {
    await this.client.initElectrum({
      client: 'satsigner',
      version: '1.4'
    })
  }

  close() {
    this.client.close()
  }

  reconnect() {
    this.client.reconnect()
  }

  addressToScriptHash(address: string) {
    const network = this.network
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

    return { utxos, transactions, balance }
  }

  async getBlockTimestamp(height: number): Promise<number> {
    const blockHeader = await this.client.blockchainBlock_header(height)
    const block = bitcoinjs.Block.fromHex(blockHeader)
    return block.timestamp
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
      const value = prevTx.outs[vout].value
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
    return utxos.map((electrumUtxo, index) => {
      return {
        txid: electrumUtxo.tx_hash,
        value: electrumUtxo.value,
        vout: electrumUtxo.tx_pos,
        addressTo: address,
        keychain: addressKeychain,
        timestamp: new Date(timestamps[index] * 1000),
        label: '',
        script: [...bitcoinjs.address.toOutputScript(address, this.network)]
      } as Utxo
    })
  }

  parseAddressTransactions(
    address: string,
    rawTransactions: string[],
    heights: number[],
    timestamps: number[]
  ): Transaction[] {
    const transactions: Transaction[] = []
    const network = this.network

    // this is used to look up the parent transaction of an input
    const parsedTransactions: TxDecoded[] = []
    const txDictionary: Record<string, number> = {}

    rawTransactions.forEach((rawTx, index) => {
      const parsedTx = TxDecoded.fromHex(rawTx)
      const tx: Transaction = {
        id: parsedTx.getId(),
        type: 'send',
        sent: 0,
        received: 0,
        address,
        blockHeight: heights[index],
        timestamp: new Date(timestamps[index] * 1000),
        lockTime: parsedTx.locktime,
        lockTimeEnabled: parsedTx.locktime > 0,
        version: parsedTx.version,
        label: '',
        raw: parseHexToBytes(rawTx),
        vout: [],
        vin: [],
        vsize: parsedTx.virtualSize(),
        weight: parsedTx.weight(),
        size: parsedTx.byteLength(),
        prices: {}
      }

      transactions.push(tx)
      parsedTransactions.push(parsedTx)
      txDictionary[tx.id] = index
    })

    // Compute sent and received vales
    // Also, add the fields VINS && VOUTS to the transaction
    for (let i = 0; i < transactions.length; i++) {
      const currentTx = parsedTransactions[i]
      const outputCount = Number(currentTx.getOutputCount().value)
      const inputCount = Number(currentTx.getInputCount().value)

      for (let j = 0; j < outputCount; j++) {
        const addr = currentTx.generateOutputScriptAddress(j, network)
        const value = Number(currentTx.getOutputValue(j).value)
        const script = [...currentTx.outs[j].script]

        transactions[i].vout.push({ address: addr, value, script })

        // Compute received value by checking if tx outputs match address
        if (addr !== address) continue
        transactions[i].received += value
      }

      for (let j = 0; j < inputCount; j++) {
        const prevTxId = currentTx.getInputHash(j).value as string
        const vout = Number(currentTx.getInputIndex(j).value)
        const sequence = currentTx.ins[j].sequence
        const witness = currentTx.ins[j].witness.map((w) => [...w])
        const scriptSig = [...currentTx.ins[j].script]

        transactions[i].vin?.push({
          previousOutput: {
            txid: prevTxId,
            vout
          },
          sequence,
          scriptSig,
          witness
        })

        if (txDictionary[prevTxId] === undefined) continue
        const prevTxIndex = txDictionary[prevTxId]
        const parentTx = parsedTransactions[prevTxIndex]
        const addr = parentTx.generateOutputScriptAddress(vout, network)

        // Compute sent value by checking if tx inputs match address
        if (addr !== address) continue
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
      if (!raw) continue
      const txHex = bytesToHex(raw)
      txidToParsedTxIndex[id] = parsedTransactions.length
      parsedTransactions.push(TxDecoded.fromHex(txHex))
    }

    // Compute sent and received vales
    // Also, add the fields VINS && VOUTS to the transaction
    for (let i = 0; i < transactions.length; i++) {
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
        vout: [],
        vin: [],
        received: 0,
        sent: 0
      }

      for (let j = 0; j < outputCount; j++) {
        const addr = currentTx.generateOutputScriptAddress(j, this.network)
        const value = Number(currentTx.getOutputValue(j).value)
        const script = [...currentTx.outs[j].script]

        transactions[i].vout.push({ address: addr, value, script })

        // Compute received value by checking if tx outputs match address
        if (addr !== address) continue
        transactions[i].received += value
      }

      for (let j = 0; j < inputCount; j++) {
        const prevTxId = currentTx.getInputHash(j).value as string
        const vout = Number(currentTx.getInputIndex(j).value)
        const sequence = currentTx.ins[j].sequence
        const witness = currentTx.ins[j].witness.map((w) => [...w])
        const scriptSig = [...currentTx.ins[j].script]

        transactions[i].vin?.push({
          previousOutput: {
            txid: prevTxId,
            vout
          },
          sequence,
          scriptSig,
          witness
        })

        if (txidToParsedTxIndex[prevTxId] === undefined) continue
        const prevTxIndex = txidToParsedTxIndex[prevTxId]
        const parentTx = parsedTransactions[prevTxIndex]
        const addr = parentTx.generateOutputScriptAddress(vout, this.network)

        // Compute sent value by checking if tx inputs match address
        if (addr !== address) continue
        const value = Number(parentTx.getOutputValue(vout).value)
        transactions[i].sent += value
      }

      transactions[i].type =
        transactions[i].received > transactions[i].sent ? 'receive' : 'send'
    }

    return transactions
  }
}

export default ElectrumClient
