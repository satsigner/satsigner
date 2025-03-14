import { type Wallet } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletOverview, syncWallet } from '@/api/bdk'
import { MempoolOracle } from '@/api/blockchain'
import { getBlockchainConfig } from '@/config/servers'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'
import { formatTimestamp } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'

function useSyncAccountWithWallet() {
  const setIsSyncing = useAccountsStore((state) => state.setIsSyncing)
  const [backend, network, retries, stopGap, timeout, url] = useBlockchainStore(
    useShallow((state) => [
      state.backend,
      state.network,
      state.retries,
      state.stopGap,
      state.timeout,
      state.url
    ])
  )

  const [loading, setLoading] = useState(false)

  async function syncAccountWithWallet(account: Account, wallet: Wallet) {
    setLoading(true)
    setIsSyncing(account.id, true)

    // Labels backup
    const labelsBackup: Record<string, string> = {}
    for (const transaction of account.transactions) {
      labelsBackup[transaction.id] = transaction.label || ''
    }
    for (const utxo of account.utxos) {
      labelsBackup[getUtxoOutpoint(utxo)] = utxo.label || ''
    }

    await syncWallet(
      wallet,
      backend,
      getBlockchainConfig(backend, url, { retries, stopGap, timeout })
    )

    const walletSummary = await getWalletOverview(wallet, network as Network)

    const updatedAccount: Account = { ...account }

    updatedAccount.transactions = walletSummary.transactions
    updatedAccount.utxos = walletSummary.utxos
    updatedAccount.summary = walletSummary.summary

    //Labels update
    for (const index in updatedAccount.utxos) {
      const utxoRef = getUtxoOutpoint(updatedAccount.utxos[index])
      updatedAccount.utxos[index].label = labelsBackup[utxoRef] || ''
    }
    for (const index in updatedAccount.transactions) {
      const transactionRef = updatedAccount.transactions[index].id
      updatedAccount.transactions[index].label =
        labelsBackup[transactionRef] || ''
    }

    //Extract timestamps
    const timestamps = updatedAccount.transactions
      .filter((transaction) => transaction.timestamp)
      .map((transaction) => formatTimestamp(transaction.timestamp!))

    //Fetch Prices
    const oracle = new MempoolOracle()
    const prices = await oracle.getPricesAt('USD', timestamps)

    //Transaction prices update
    for (const index in updatedAccount.transactions) {
      updatedAccount.transactions[index].prices = { USD: prices[index] }
    }

    setLoading(false)
    setIsSyncing(account.id, false)

    return updatedAccount
  }

  return { syncAccountWithWallet, loading }
}

export default useSyncAccountWithWallet
