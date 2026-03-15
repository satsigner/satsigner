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

      // Capture cached prices before overwriting transactions with fresh BDK data
      const cachedPrices: Record<string, number | undefined> = {}
      for (const tx of account.transactions) {
        if (tx.prices?.USD !== undefined) {
          cachedPrices[tx.id] = tx.prices.USD
        }
      }

      let updatedAccount: Account = { ...account }

      updatedAccount.transactions = walletSummary.transactions
      updatedAccount.utxos = walletSummary.utxos
      updatedAccount.addresses = walletSummary.addresses
      updatedAccount.summary = walletSummary.summary

      updatedAccount.addresses = parseAccountAddressesDetails(updatedAccount)
      updatedAccount = updateAccountObjectLabels(updatedAccount)

      // Apply cached prices and collect timestamps only for unpriced transactions
      const unpricedTimestamps: number[] = []
      for (const tx of updatedAccount.transactions) {
        if (cachedPrices[tx.id] !== undefined) {
          tx.prices = { USD: cachedPrices[tx.id]! }
        } else if (tx.timestamp) {
          unpricedTimestamps.push(formatTimestamp(tx.timestamp))
        }
      }

      if (unpricedTimestamps.length > 0) {
        const uniqueTimestamps = [...new Set(unpricedTimestamps)]
        const mempoolUrl = configsMempol['bitcoin']
        const oracle = new MempoolOracle(mempoolUrl)
        const fetchedPrices = await oracle.getPricesAt('USD', uniqueTimestamps)
        const priceMap: Record<number, number> = {}
        uniqueTimestamps.forEach((ts, i) => {
          priceMap[ts] = fetchedPrices[i]
        })
        for (const tx of updatedAccount.transactions) {
          if (!tx.prices?.USD && tx.timestamp) {
            const price = priceMap[formatTimestamp(tx.timestamp)]
            if (price !== undefined) tx.prices = { USD: price }
          }
        }
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
