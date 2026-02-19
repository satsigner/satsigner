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
import { updateAccountObjectLabels } from '@/utils/account'
import { formatTimestamp } from '@/utils/format'
import { parseAccountAddressesDetails } from '@/utils/parse'

function useSyncAccountWithWallet() {
  const setSyncStatus = useAccountsStore((state) => state.setSyncStatus)

  const [selectedNetwork, configs, configsMempol] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configs,
      state.configsMempool
    ])
  )
  const { server, config } = configs[selectedNetwork]

  const [loading, setLoading] = useState(false)

  async function syncAccountWithWallet(account: Account, wallet: Wallet) {
    try {
      setLoading(true)
      setSyncStatus(account.id, 'syncing')

      await syncWallet(
        wallet,
        server.backend,
        getBlockchainConfig(server.backend, server.url, {
          retries: config.retries,
          stopGap: config.stopGap,
          timeout: config.timeout * 1000
        })
      )

      const walletSummary = await getWalletOverview(
        wallet,
        server.network as Network,
        config.stopGap
      )

      let updatedAccount: Account = { ...account }

      updatedAccount.transactions = walletSummary.transactions
      updatedAccount.utxos = walletSummary.utxos
      updatedAccount.addresses = walletSummary.addresses
      updatedAccount.summary = walletSummary.summary

      updatedAccount.addresses = parseAccountAddressesDetails(updatedAccount)
      updatedAccount = updateAccountObjectLabels(updatedAccount)

      const timestamps = updatedAccount.transactions
        .filter((transaction) => transaction.timestamp)
        .map((transaction) => formatTimestamp(transaction.timestamp!))

      const network = 'bitcoin'
      const mempoolUrl = configsMempol[network]
      const oracle = new MempoolOracle(mempoolUrl)
      const prices = await oracle.getPricesAt('USD', timestamps)

      for (const index in updatedAccount.transactions) {
        updatedAccount.transactions[index].prices = { USD: prices[index] }
      }

      updatedAccount.syncStatus = 'synced'
      updatedAccount.lastSyncedAt = new Date()

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
