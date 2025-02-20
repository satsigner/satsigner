import * as bitcoinjs from 'bitcoinjs-lib'
// @ts-ignore @eslint-disable-next-line
import RnElectrumClient from 'electrum-client'
import TcpSocket from 'react-native-tcp-socket'

import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { parseHexToBytes } from '@/utils/parse'
import { TxDecoded } from '@/utils/txDecoded'

type IElectrumClient = {
  props: {
    host: string
    port: number
    protocol?: 'tcp' | 'tls' | 'ssl'
    network?: bitcoinjs.Network
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

class BaseElectrumClient {
  client: any
  network: bitcoinjs.networks.Network

  constructor({
    host,
    port,
    protocol = 'ssl',
    network = bitcoinjs.networks.testnet
  }: IElectrumClient['props']) {
    const net = TcpSocket
    const tls = TcpSocket
    const options = {}
    this.client = new RnElectrumClient(net, tls, port, host, protocol, options)
    this.network = network as never as bitcoinjs.networks.Network
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

  // async getTransactions(txIds: string[]): Promise<IElectrumClient['transaction']> {
  async getTransactions(txIds: string[]): Promise<string[]> {
    const verbose = false // verbose=true is not supported by some clients
    const result = (await this.client.blockchainTransaction_getBatch(
      txIds,
      verbose
    )) as IElectrumClient['transactionRaw'][]
    return result.map((item) => item.result)
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
    const transactions = this.parseAddressTransactions(
      address,
      rawTransactions,
      txHeights,
      txTimestamps
    )

    const balance = await this.getAddressBalance(address)

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
      const tx = {
        id: parsedTx.getId(),
        type: 'receive',
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
      } as Transaction

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
}

export default ElectrumClient
