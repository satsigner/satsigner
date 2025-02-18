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

type AddressInfo = {
  transactions: Transaction[]
  utxos: Utxo[]
  balance: {
    confirmed: number
    unconfirmed: number
  }
}

class ElectrumClient extends BaseElectrumClient {
  async getAddressInfo(
    address: string,
    addressKeychain: Utxo['keychain'] = 'external'
  ): Promise<AddressInfo> {
    const addressTxs = await super.getAddressTransactions(address)
    const addressUtxos = await super.getAddressUtxos(address)
    const txIds = addressTxs.map((value) => value.tx_hash)
    const rawTransactions = await this.getTransactions(txIds)
    const balance = await this.getAddressBalance(address)

    const network = this.network
    const transactions: Transaction[] = []
    const utxos: Utxo[] = []

    // this is used to look up the parent transaction of an input
    const parsedTxs: TxDecoded[] = []
    const txDictionary: Record<string, number> = {}

    addressUtxos.forEach((electrumUtxo) => {
      const utxo: Utxo = {
        txid: electrumUtxo.tx_hash,
        value: electrumUtxo.value,
        vout: electrumUtxo.tx_pos,
        addressTo: address,
        keychain: addressKeychain,
        label: '',
        script: [...bitcoinjs.address.toOutputScript(address, network)]
      }

      utxos.push(utxo)
    })

    rawTransactions.forEach((rawTx, index) => {
      const parsedTx = TxDecoded.fromHex(rawTx)
      const tx = {
        id: parsedTx.getId(),
        type: 'send',
        sent: 0,
        received: 0,
        address,
        lockTime: parsedTx.locktime,
        lockTimeEnabled: parsedTx.locktime > 0,
        version: parsedTx.version,
        label: '',
        raw: parseHexToBytes(rawTx),
        vsize: parsedTx.virtualSize(),
        weight: parsedTx.weight(),
        size: parsedTx.byteLength(),
        prices: {}
      } as Transaction

      transactions.push(tx)
      parsedTxs.push(parsedTx)
      txDictionary[tx.id] = index
    })

    for (let i = 0; i < transactions.length; i++) {
      const outputCount = Number(parsedTxs[i].getOutputCount().value)
      const inputCount = Number(parsedTxs[i].getInputCount().value)

      for (let j = 0; j < outputCount; j++) {
        const addr = parsedTxs[i].generateOutputScriptAddress(j, network)
        if (addr !== address) continue

        const value = Number(parsedTxs[i].getOutputValue(j).value)
        transactions[i].received += value
      }

      for (let j = 0; j < inputCount; j++) {
        const prevTxId = parsedTxs[i].getInputHash(j).value
        if (!txDictionary[prevTxId]) continue

        const prevTxIndex = txDictionary[prevTxId]
        const vout = Number(parsedTxs[i].getInputIndex(j).value)
        const addr = parsedTxs[prevTxIndex].generateOutputScriptAddress(
          vout,
          network
        )
        if (addr !== address) continue

        const value = Number(parsedTxs[prevTxIndex].getOutputValue(j).value)
        transactions[i].sent += value
      }

      transactions[i].type = transactions[i].sent > 0 ? 'send' : 'receive'
    }

    return { utxos, transactions, balance }
  }
}

export default ElectrumClient
