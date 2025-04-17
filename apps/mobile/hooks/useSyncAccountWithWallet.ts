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
import { parseAccountAddressesDetails } from '@/utils/parse'
import { getUtxoOutpoint } from '@/utils/utxo'

function useSyncAccountWithWallet() {
  const setSyncStatus = useAccountsStore((state) => state.setSyncStatus)
  const [backend, network, retries, stopGap, timeout, url] = useBlockchainStore(
    useShallow((state) => {
      const { server, param } = state.configs[state.selectedNetwork]
      return [
        server.backend,
        server.network,
        param.retries,
        param.stopGap,
        param.timeout,
        server.url
      ]
    })
  )

  const [loading, setLoading] = useState(false)

  async function syncAccountWithWallet(account: Account, wallet: Wallet) {
    try {
      setLoading(true)
      setSyncStatus(account.id, 'syncking')

      // Labels backup
      const labelsBackup: Record<string, string> = {}
      for (const transaction of account.transactions) {
        labelsBackup[transaction.id] = transaction.label || ''
      }
      for (const utxo of account.utxos) {
        labelsBackup[getUtxoOutpoint(utxo)] = utxo.label || ''
      }
      for (const address of account.addresses) {
        labelsBackup[address.address] = address.label || ''
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
      updatedAccount.addresses = walletSummary.addresses
      updatedAccount.summary = walletSummary.summary

      //Attach additional information to the account addresses
      updatedAccount.addresses = parseAccountAddressesDetails(updatedAccount)

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
      for (const index in updatedAccount.addresses) {
        const addressRef = updatedAccount.addresses[index].address
        updatedAccount.addresses[index].label = labelsBackup[addressRef] || ''
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

      updatedAccount.syncStatus = 'synced'
      updatedAccount.syncDate = new Date()

      return updatedAccount
    } catch {
      setSyncStatus(account.id, 'error')
      return account
    } finally {
      setLoading(false)
    }
  }

  return { syncAccountWithWallet, loading }
}

export default useSyncAccountWithWallet
