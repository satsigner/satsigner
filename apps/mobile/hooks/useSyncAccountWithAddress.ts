import * as bitcoinjs from 'bitcoinjs-lib'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Network } from '@/types/settings/blockchain'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { formatTimestamp } from '@/utils/format'
import { parseAddressDescriptorToAddress, parseHexToBytes } from '@/utils/parse'
import { getUtxoOutpoint } from '@/utils/utxo'

type AddressInfo = {
  transactions: Transaction[]
  utxos: Utxo[]
  progress: Account['syncProgress']
}

// Hook required because bdk does not support address descriptor
function useSyncAccountWithAddress() {
  const [setSyncStatus, updateAccount, setSyncProgress] = useAccountsStore(
    useShallow((state) => [
      state.setSyncStatus,
      state.updateAccount,
      state.setSyncProgress
    ])
  )

  const [backend, network, url, configsMempol] = useBlockchainStore(
    useShallow((state) => {
      const { server } = state.configs[state.selectedNetwork]
      return [server.backend, server.network, server.url, state.configsMempool]
    })
  )

  const [loading, setLoading] = useState(false)

  async function syncAccountWithAddressUsingEsplora(
    account: Account,
    address: string,
    url: string
  ): Promise<AddressInfo> {
    let confirmed = 0
    let unconfirmed = 0

    const esploraClient = new Esplora(url)

    // update sync progress
    account.syncProgress = {
      totalTasks: account.syncProgress?.totalTasks || 0,
      tasksDone: account.syncProgress?.tasksDone || 0
    }
    account.syncProgress.totalTasks += 2
    setSyncProgress(account.id, account.syncProgress)

    // make the request
    const esploraTxs = await esploraClient.getAddressTx(address)
    const esploraUtxos = await esploraClient.getAddressUtxos(address)

    // update sync progress
    account.syncProgress.tasksDone += 2
    setSyncProgress(account.id, account.syncProgress)

    // update summary
    account.summary = {
      ...account.summary,
      numberOfTransactions: esploraTxs.length,
      numberOfUtxos: esploraUtxos.length,
      numberOfAddresses: 1
    }
    updateAccount(account)

    // because we update the whole account at once, spread is necessary
    account.syncProgress = { ...account.syncProgress }

    // compute how much more requests are needed
    const existingTx: Record<string, number> = {}
    account.transactions.forEach((tx, index) => {
      existingTx[tx.id] = index
    })
    for (const tx of esploraTxs) {
      if (existingTx[tx.txid] === undefined) {
        account.syncProgress.totalTasks += 1
      }
    }
    setSyncProgress(account.id, account.syncProgress)

    const txDictionary: Record<string, number> = {}

    for (let index = 0; index < esploraTxs.length; index++) {
      const t = esploraTxs[index]

      if (existingTx[t.txid] !== undefined) {
        continue
      }

      const vin: Transaction['vin'] = []
      const vout: Transaction['vout'] = []
      let sent = 0
      let received = 0

      t.vin.forEach((input) => {
        vin.push({
          previousOutput: {
            txid: input.txid,
            vout: input.vout
          },
          sequence: input.sequence,
          scriptSig: parseHexToBytes(input.scriptsig),
          witness: input.witness ? input.witness.map(parseHexToBytes) : []
        })
        if (input.prevout.scriptpubkey_address === address) {
          sent += input.prevout.value
        }
      })

      t.vout.forEach((out) => {
        vout.push({
          value: out.value,
          address: out.scriptpubkey_address,
          script: parseHexToBytes(out.scriptpubkey)
        })
        if (out.scriptpubkey_address === address) {
          received += out.value
        }
      })

      const raw = await esploraClient.getTxHex(t.txid)

      const tx: Transaction = {
        address,
        blockHeight: t.status.block_height,
        fee: t.fee,
        id: t.txid,
        label: '',
        lockTime: t.locktime,
        lockTimeEnabled: t.locktime > 0,
        prices: {},
        raw: parseHexToBytes(raw),
        received,
        sent,
        size: t.size,
        timestamp: new Date(t.status.block_time * 1000),
        type: sent > 0 ? 'send' : 'receive',
        version: t.version,
        vin,
        vout,
        weight: t.weight
      }

      txDictionary[tx.id] = index
      account.transactions = [...account.transactions, tx]
      account.syncProgress = { ...account.syncProgress }
      updateAccount(account)

      account.syncProgress = { ...account.syncProgress }
      account.syncProgress.tasksDone += 1
      setSyncProgress(account.id, account.syncProgress)
    }

    // update utxos
    account.utxos = esploraUtxos.map((u) => {
      if (u.status.confirmed) {
        confirmed += u.value
      } else {
        unconfirmed += u.value
      }

      let script: number[] | undefined

      if (txDictionary[u.txid] !== undefined) {
        const index = txDictionary[u.txid]
        const tx = esploraTxs[index]
        script = parseHexToBytes(tx.vout[u.vout].scriptpubkey)
      }

      const utxo: Utxo = {
        txid: u.txid,
        vout: u.vout,
        value: u.value,
        label: '',
        addressTo: address,
        keychain: 'external',
        script,
        timestamp: u.status.block_time
          ? new Date(u.status.block_time * 1000)
          : undefined
      }
      return utxo
    })

    // update account
    account.summary = {
      ...account.summary,
      balance: confirmed,
      satsInMempool: unconfirmed
    }
    updateAccount(account)

    return {
      transactions: account.transactions,
      utxos: account.utxos,
      progress: account.syncProgress
    }
  }

  async function syncAccountWithAddressUsingElectrum(
    account: Account,
    address: string,
    url: string,
    network: Network
  ): Promise<AddressInfo> {
    const electrumClient = ElectrumClient.fromUrl(url, network)
    await electrumClient.init()

    account.syncProgress = {
      tasksDone: account.syncProgress?.tasksDone || 0,
      totalTasks: account.syncProgress?.tasksDone || 0
    }

    // update tasks because we need to perform 3 requests
    account.syncProgress.totalTasks += 3
    setSyncProgress(account.id, account.syncProgress)

    // make the requests
    const addressUtxos = await electrumClient.getAddressUtxos(address)
    const addressTxs = await electrumClient.getAddressTransactions(address)
    const balance = await electrumClient.getAddressBalance(address)

    // update progress
    account.syncProgress.tasksDone += 3
    setSyncProgress(account.id, account.syncProgress)

    // update summary
    account.summary = {
      numberOfTransactions: addressTxs.length,
      numberOfUtxos: addressUtxos.length,
      numberOfAddresses: 1,
      balance: balance.confirmed,
      satsInMempool: balance.unconfirmed
    }
    updateAccount(account)

    // prevent modifying object just updated in store
    account.syncProgress = { ...account.syncProgress }

    // transactions and utxos already known
    const existingTx: Record<string, number> = {}
    const existingUtxo: Record<string, number> = {}

    account.transactions.forEach((tx, index) => {
      existingTx[tx.id] = index
    })
    account.utxos.forEach((utxo, index) => {
      existingUtxo[getUtxoOutpoint(utxo)] = index
    })

    // transactions and utxos not known by the wallet
    const pendingTx = addressTxs.filter((t) => {
      return existingTx[t.tx_hash] === undefined
    })
    const pendingUtxos = addressUtxos.filter((u) => {
      return existingUtxo[`${u.tx_hash}:${u.tx_pos}`] === undefined
    })

    // update progress
    const estimatedRequests = pendingTx.length * 2 + pendingUtxos.length
    account.syncProgress.totalTasks += estimatedRequests
    setSyncProgress(account.id, account.syncProgress)

    // variable to track timestamp data for both transactions and utxos
    const timestampByHeight: Record<number, number> = {}

    // we keep old transactions, which we assume were fully fetched,
    // because we will load partial fetched transactions one by one
    const oldTransactions = [...account.transactions]

    const rawTransactions = []
    const txTimestamps: number[] = []
    const txHeights = pendingTx.map((value) => value.height)

    for (const tx of pendingTx) {
      const txid = tx.tx_hash
      const height = tx.height

      // fetch raw transaction
      const rawTx = await electrumClient.getTransaction(txid)
      rawTransactions.push(rawTx)

      // update progress
      account.syncProgress.tasksDone += 1
      setSyncProgress(account.id, account.syncProgress)

      // fetch timestamp
      if (!timestampByHeight[height]) {
        timestampByHeight[height] =
          await electrumClient.getBlockTimestamp(height)
      }
      const timestamp = timestampByHeight[height]
      txTimestamps.push(timestamp)

      // update progress
      account.syncProgress.tasksDone += 1
      setSyncProgress(account.id, account.syncProgress)

      // Update partial transaction.
      // It is still missing vin and vout which must update later.
      const rawTxParsed = bitcoinjs.Transaction.fromHex(rawTx)
      const transaction: Transaction = {
        id: rawTxParsed.getId(),
        type: 'receive',
        sent: 0,
        received: 0,
        address,
        blockHeight: height,
        timestamp: new Date(timestamp * 1000),
        lockTime: rawTxParsed.locktime,
        lockTimeEnabled: rawTxParsed.locktime > 0,
        version: rawTxParsed.version,
        label: '',
        raw: parseHexToBytes(rawTx),
        vout: [],
        vin: [],
        vsize: rawTxParsed.virtualSize(),
        weight: rawTxParsed.weight(),
        size: rawTxParsed.byteLength(),
        prices: {}
      }
      account.transactions = [...account.transactions, transaction]
      updateAccount(account)

      // prevent modifying object just updated in store
      account.syncProgress = { ...account.syncProgress }
    }

    // Parse the raw transaction and timestamps to transaction objects.
    // This will  correctly include vin and vout.
    // TODO: include old transactions here too.
    const newTransactions = electrumClient.parseAddressTransactions(
      address,
      rawTransactions,
      txHeights,
      txTimestamps
    )
    account.transactions = [...oldTransactions, ...newTransactions]
    updateAccount(account)

    // prevent modifying store object just updated
    account.syncProgress = { ...account.syncProgress }

    // hard-coded keychain but we can safely assume it is correct.
    // Who would setup watch-only for a change address?
    const addressKeychain = 'external'

    // fetch timestamps for new utxos
    for (const electrumUtxo of pendingUtxos) {
      const height = electrumUtxo.height

      if (!timestampByHeight[height]) {
        timestampByHeight[height] =
          await electrumClient.getBlockTimestamp(height)
      }

      const timestamp = timestampByHeight[height]

      // update progress
      account.syncProgress.tasksDone += 1
      setSyncProgress(account.id, account.syncProgress)

      // construct utxo
      const utxo: Utxo = {
        txid: electrumUtxo.tx_hash,
        value: electrumUtxo.value,
        vout: electrumUtxo.tx_pos,
        addressTo: address,
        keychain: addressKeychain,
        timestamp: new Date(timestamp * 1000),
        label: '',
        script: [
          ...bitcoinjs.address.toOutputScript(
            address,
            bitcoinjsNetwork(network)
          )
        ]
      }

      // update account utxos
      account.utxos = [...account.utxos, utxo]
      updateAccount(account)

      // prevent modifying object just updated in store
      account.syncProgress = { ...account.syncProgress }
    }

    try {
      electrumClient.close()
    } catch {
      //
    }

    return {
      transactions: account.transactions,
      utxos: account.utxos,
      progress: account.syncProgress
    }
  }

  async function syncAccountWithAddress(
    account: Account,
    addressDescriptor: string
  ) {
    setLoading(true)
    setSyncStatus(account.id, 'syncing')

    const updatedAccount: Account = {
      ...account,
      syncStatus: 'syncing'
    }

    try {
      // Labels backup
      const labelsBackup: Record<string, string> = {}
      for (const transaction of account.transactions) {
        labelsBackup[transaction.id] = transaction.label || ''
      }
      for (const utxo of account.utxos) {
        labelsBackup[getUtxoOutpoint(utxo)] = utxo.label || ''
      }

      // the address extracted from the descriptor
      const address = parseAddressDescriptorToAddress(addressDescriptor)

      // reset the account sync progress
      updatedAccount.syncProgress = {
        tasksDone: 0,
        totalTasks: 0
      }
      setSyncProgress(updatedAccount.id, updatedAccount.syncProgress)

      let addrInfo: AddressInfo | undefined

      if (backend === 'esplora') {
        addrInfo = await syncAccountWithAddressUsingEsplora(
          updatedAccount,
          address,
          url
        )
      } else if (backend === 'electrum') {
        addrInfo = await syncAccountWithAddressUsingElectrum(
          updatedAccount,
          address,
          url,
          network
        )
      } else {
        throw new Error('unkown backend')
      }

      updatedAccount.transactions = addrInfo.transactions
      updatedAccount.utxos = addrInfo.utxos

      // Labels update
      for (const index in updatedAccount.utxos) {
        const utxoRef = getUtxoOutpoint(updatedAccount.utxos[index])
        updatedAccount.utxos[index].label = labelsBackup[utxoRef] || ''
      }
      for (const index in updatedAccount.transactions) {
        const transactionRef = updatedAccount.transactions[index].id
        updatedAccount.transactions[index].label =
          labelsBackup[transactionRef] || ''
      }

      // collect timestamps of transactions without price data
      const timestamps = [
        ...new Set(
          updatedAccount.transactions
            .filter((transaction) => {
              return transaction.timestamp && transaction.prices['USD']
            })
            .map((transaction) => {
              return formatTimestamp(transaction.timestamp!)
            })
        )
      ]

      // update progress status because we are about to fetch price data
      updatedAccount.syncProgress = {
        tasksDone: addrInfo.progress?.tasksDone || 0,
        totalTasks: (addrInfo.progress?.totalTasks || 0) + timestamps.length
      }

      //Fetch Prices
      const mempoolUrl = configsMempol['bitcoin']
      const oracle = new MempoolOracle(mempoolUrl)
      const prices = await oracle.getPricesAt('USD', timestamps)

      // update prices
      const priceTimestamps: Record<number, number> = {}
      for (let i = 0; i < timestamps.length; i += 1) {
        priceTimestamps[timestamps[i]] = prices[i]
      }
      for (let i = 0; i < updatedAccount.transactions.length; i += 1) {
        const transaction = updatedAccount.transactions[i]
        if (!transaction.timestamp) {
          continue
        }
        const timestamp = Math.trunc(transaction.timestamp.getTime() / 1000)
        if (priceTimestamps[timestamp] === undefined) {
          continue
        }
        const price = priceTimestamps[timestamp]
        updatedAccount.transactions[i].prices = { USD: price }
      }

      // Update account progress again
      updatedAccount.syncProgress.tasksDone += timestamps.length
      setSyncProgress(updatedAccount.id, updatedAccount.syncProgress)

      // Update sync status
      updatedAccount.syncStatus = 'synced'
      updatedAccount.lastSyncedAt = new Date()

      updatedAccount.syncProgress.totalTasks = 0
      updatedAccount.syncProgress.tasksDone = 0
      setLoading(false)
      return updatedAccount
    } catch {
      setSyncStatus(account.id, 'error')
      setLoading(false)
      throw new Error('sync failed')
    }
  }

  return { syncAccountWithAddress, loading }
}

export default useSyncAccountWithAddress
