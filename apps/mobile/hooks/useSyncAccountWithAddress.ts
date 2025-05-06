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
import { formatTimestamp } from '@/utils/format'
import { parseAddressDescriptorToAddress, parseHexToBytes } from '@/utils/parse'
import { getUtxoOutpoint } from '@/utils/utxo'

type AddressInfo = {
  transactions: Transaction[]
  utxos: Utxo[]
  confirmed: number
  unconfirmed: number
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

  const [backend, network, url] = useBlockchainStore(
    useShallow((state) => {
      const { server } = state.configs[state.selectedNetwork]
      return [server.backend, server.network, server.url]
    })
  )

  const [loading, setLoading] = useState(false)

  async function syncAccountWithAddressUsingEsplora(
    account: Account,
    address: string,
    url: string
  ): Promise<AddressInfo> {
    const transactions: Account['transactions'] = []
    const utxos: Account['utxos'] = []
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

    // compute how much more requests are needed
    const existingTx: Record<string, number> = {}
    account.transactions.forEach((tx, index) => {
      existingTx[tx.id] = index
    })
    for (const tx of esploraTxs) {
      if (existingTx[tx.txid] !== undefined) {
        account.syncProgress.totalTasks += 1
      }
    }
    account.syncProgress.tasksDone += 2
    setSyncProgress(account.id, account.syncProgress)

    const txDictionary: Record<string, number> = {}

    for (let index = 0; index < esploraTxs.length; index++) {
      const t = esploraTxs[index]

      if (existingTx[t.txid] !== undefined) {
        const txIndex = existingTx[t.txid]
        transactions.push(account.transactions[txIndex])
        account.syncProgress.tasksDone += 1
        setSyncProgress(account.id, account.syncProgress)
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

      const tx = {
        address,
        blockHeight: t.status.block_height,
        fee: t.fee,
        id: t.txid,
        label: '',
        locktime: t.locktime,
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
      } as Transaction

      txDictionary[tx.id] = index
      transactions.push(tx)
    }

    // update utxos
    utxos.push(
      ...esploraUtxos.map((u) => {
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

        return {
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
        } as Utxo
      })
    )

    // update account
    account.transactions = transactions
    account.utxos = utxos
    updateAccount(account)

    return {
      transactions,
      utxos,
      confirmed,
      unconfirmed,
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
    account.syncProgress.totalTasks += 3
    setSyncProgress(account.id, account.syncProgress)

    const addressUtxos = await electrumClient.getAddressUtxos(address)
    const addressTxs = await electrumClient.getAddressTransactions(address)
    const balance = await electrumClient.getAddressBalance(address)

    account.syncProgress.tasksDone += 3
    setSyncProgress(account.id, account.syncProgress)

    const existingTx: Record<string, number> = {}
    const existingUtxo: Record<string, number> = {}

    account.transactions.forEach((tx, index) => {
      existingTx[tx.id] = index
    })
    account.utxos.forEach((utxo, index) => {
      existingUtxo[getUtxoOutpoint(utxo)] = index
    })

    const filteredTx = addressTxs.filter((t) => {
      return existingTx[t.tx_hash] === undefined
    })
    const filteredUtxos = addressUtxos.filter((u) => {
      return existingUtxo[`${u.tx_hash}:${u.tx_pos}`] === undefined
    })

    account.syncProgress.totalTasks +=
      filteredTx.length * 2 + filteredUtxos.length
    setSyncProgress(account.id, account.syncProgress)

    // keep track of timestamps
    const timestampDict: Record<number, number> = {}

    const utxoHeights = filteredUtxos.map((value) => value.height)
    const utxoTimestamps: number[] = []
    for (const height of utxoHeights) {
      if (!timestampDict[height]) {
        timestampDict[height] = await electrumClient.getBlockTimestamp(height)
      }
      utxoTimestamps.push(timestampDict[height])

      // update progress
      account.syncProgress.tasksDone += 1
      setSyncProgress(account.id, account.syncProgress)
    }

    const addressKeychain = 'external'
    const newUtxos: Utxo[] = electrumClient.parseAddressUtxos(
      address,
      filteredUtxos,
      utxoTimestamps,
      addressKeychain
    )
    account.utxos = [...account.utxos, ...newUtxos]
    updateAccount(account)

    const txIds = filteredTx.map((value) => value.tx_hash)
    const rawTransactions = []
    for (const txid of txIds) {
      const rawTx = await electrumClient.getTransaction(txid)
      rawTransactions.push(rawTx)

      // update progress
      account.syncProgress.tasksDone += 1
      setSyncProgress(account.id, account.syncProgress)
    }

    const txHeights = filteredTx.map((value) => value.height)
    const txTimestamps: number[] = []
    for (const height of txHeights) {
      if (!timestampDict[height]) {
        timestampDict[height] = await electrumClient.getBlockTimestamp(height)
      }
      txTimestamps.push(timestampDict[height])

      // update progress
      account.syncProgress.tasksDone += 1
      setSyncProgress(account.id, account.syncProgress)
    }

    const newTransactions = electrumClient.parseAddressTransactions(
      address,
      rawTransactions,
      txHeights,
      txTimestamps
    )
    account.transactions = [...account.transactions, ...newTransactions]
    updateAccount(account)

    try {
      electrumClient.close()
    } catch {
      //
    }

    return {
      transactions: account.transactions,
      utxos: account.utxos,
      progress: account.syncProgress,
      confirmed: balance.confirmed,
      unconfirmed: balance.unconfirmed
    }
  }

  async function syncAccountWithAddress(
    account: Account,
    addressDescriptor: string
  ) {
    try {
      setLoading(true)
      setSyncStatus(account.id, 'syncing')

      // Labels backup
      const labelsBackup: Record<string, string> = {}
      for (const transaction of account.transactions) {
        labelsBackup[transaction.id] = transaction.label || ''
      }
      for (const utxo of account.utxos) {
        labelsBackup[getUtxoOutpoint(utxo)] = utxo.label || ''
      }

      const updatedAccount: Account = { ...account }
      const address = parseAddressDescriptorToAddress(addressDescriptor)

      // update account sync progress
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

      const summary = {
        numberOfAddresses: 1,
        numberOfTransactions: addrInfo.transactions.length,
        numberOfUtxos: addrInfo.utxos.length,
        satsInMempool: addrInfo.unconfirmed,
        balance: addrInfo.confirmed
      }

      updatedAccount.transactions = addrInfo.transactions
      updatedAccount.utxos = addrInfo.utxos
      updatedAccount.summary = summary

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

      // timestamps of transactions without price data
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

      // Update progress status
      updatedAccount.syncProgress = {
        tasksDone: addrInfo.progress?.tasksDone || 0,
        totalTasks: (addrInfo.progress?.totalTasks || 0) + timestamps.length
      }

      // fetch prices
      const oracle = new MempoolOracle()
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
      return updatedAccount
    } catch {
      setSyncStatus(account.id, 'error')
      return account
    } finally {
      setLoading(false)
    }
  }

  return { syncAccountWithAddress, loading }
}

export default useSyncAccountWithAddress
