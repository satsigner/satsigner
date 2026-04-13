import { useState } from 'react'
import { type BdkWallet } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletOverview, syncWallet } from '@/api/bdk'
import { MempoolOracle } from '@/api/blockchain'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'
import { updateAccountObjectLabels } from '@/utils/account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { formatTimestamp } from '@/utils/format'
import { parseAccountAddressesDetails } from '@/utils/parse'

function useSyncAccountWithWallet() {
  const setSyncStatus = useAccountsStore((state) => state.setSyncStatus)

  const [selectedNetwork, configs, configsMempol, setLastKnownBlockHeight] =
    useBlockchainStore(
      useShallow((state) => [
        state.selectedNetwork,
        state.configs,
        state.configsMempool,
        state.setLastKnownBlockHeight
      ])
    )
  const { server, config } = configs[selectedNetwork]

  const [loading, setLoading] = useState(false)

  async function syncAccountWithWallet(account: Account, wallet: BdkWallet) {
    const latest =
      useAccountsStore.getState().accounts.find((a) => a.id === account.id) ??
      account

    try {
      setLoading(true)
      setSyncStatus(latest.id, 'syncing')

      // Use the wallet's own checkpoint to decide: if BDK already scanned
      // this wallet (checkpoint exists beyond genesis), use incremental sync.
      // This is more reliable than account.transactions.length because the
      // wallet DB and account store can be out of sync after crashes.
      const checkpoint = wallet.latestCheckpoint()
      const isFullScan = !checkpoint || checkpoint.height === 0

      await syncWallet(
        wallet,
        server.backend,
        server.url,
        config.stopGap,
        isFullScan
      )

      // Update block height from wallet's latest checkpoint
      const latestCheckpoint = wallet.latestCheckpoint()
      if (latestCheckpoint) {
        setLastKnownBlockHeight(latestCheckpoint.height)
      }

      const walletSummary = getWalletOverview(
        wallet,
        appNetworkToBdkNetwork(server.network),
        config.stopGap
      )

      // Capture cached prices before overwriting transactions with fresh BDK data
      const cachedPrices: Record<string, number | undefined> = {}
      for (const tx of latest.transactions) {
        if (tx.prices?.USD !== undefined) {
          cachedPrices[tx.id] = tx.prices.USD
        }
      }

      let updatedAccount: Account = { ...latest }

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
        try {
          const fetchedPrices = await oracle.getPricesAt(
            'USD',
            uniqueTimestamps
          )
          const priceMap: Record<number, number> = {}
          for (const [i, ts] of uniqueTimestamps.entries()) {
            priceMap[ts] = fetchedPrices[i]
          }
          for (const tx of updatedAccount.transactions) {
            if (!tx.prices?.USD && tx.timestamp) {
              const price = priceMap[formatTimestamp(tx.timestamp)]
              if (price !== undefined) {
                tx.prices = { USD: price }
              }
            }
          }
        } catch {
          toast.error(t('account.sync.historicalPricesFailed'))
        }
      }

      updatedAccount.syncStatus = 'synced'
      updatedAccount.lastSyncedAt = new Date()

      return updatedAccount
    } catch {
      setSyncStatus(latest.id, 'error')
      toast.error(t('account.syncFailed'))
      return latest
    } finally {
      setLoading(false)
    }
  }

  return { loading, syncAccountWithWallet }
}

export default useSyncAccountWithWallet
