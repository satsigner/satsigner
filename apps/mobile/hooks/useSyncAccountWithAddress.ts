import { useState } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { fetchAddressSnapshot } from '@/api/addressSync'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { type Account } from '@/types/models/Account'
import { type Currency } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import { updateAccountObjectLabels } from '@/utils/account'
import { applyAddressSnapshot } from '@/utils/addressSync'
import { decryptAccountKeySecrets } from '@/utils/decryption'
import { formatTimestamp } from '@/utils/format'
import { parseAddressDescriptorToAddress } from '@/utils/parse'
import { resolveHistoricalPrices } from '@/utils/resolveHistoricalPrices'

// Convert timestamps to Date objects and collect unix timestamps
// Skip transactions that already have a cached price — they are immutable
function collectUnpricedTimestamps(
  transactions: Transaction[],
  fiatCurrency: Currency
) {
  const timestamps: number[] = []
  for (const transaction of transactions) {
    if (transaction.prices?.[fiatCurrency] !== undefined) {
      continue
    }
    if (!transaction.timestamp) {
      continue
    }
    let date: Date
    if (typeof transaction.timestamp === 'string') {
      date = new Date(transaction.timestamp)
    } else if (transaction.timestamp instanceof Date) {
      date = transaction.timestamp
    } else {
      continue
    }

    if (!Number.isNaN(date.getTime())) {
      transaction.timestamp = date
      timestamps.push(formatTimestamp(date))
    } else {
      transaction.timestamp = undefined
    }
  }
  return timestamps
}

async function fetchHistoricalPrices(
  fiatCurrency: Currency,
  uniqueTimestamps: number[]
) {
  const emptyPrices: Record<number, number> = {}
  if (uniqueTimestamps.length === 0) {
    return emptyPrices
  }
  return await resolveHistoricalPrices(fiatCurrency, uniqueTimestamps).catch(
    () => {
      toast.error(t('account.sync.historicalPricesFailed'))
      return emptyPrices
    }
  )
}

function applyHistoricalPrices(
  updatedAccount: Account,
  priceTimestamps: Record<number, number>,
  fiatCurrency: Currency
) {
  for (let i = 0; i < updatedAccount.transactions.length; i += 1) {
    const transaction = updatedAccount.transactions[i]
    if (!transaction.timestamp || !(transaction.timestamp instanceof Date)) {
      continue
    }

    const unixTimestamp = formatTimestamp(transaction.timestamp)
    const price = priceTimestamps[unixTimestamp]

    if (price === undefined) {
      continue
    }

    const newTransaction = {
      ...updatedAccount.transactions[i],
      prices: { ...transaction.prices, [fiatCurrency]: price }
    }

    const newTransactions = [...updatedAccount.transactions]
    newTransactions[i] = newTransaction

    const newAccount = {
      ...updatedAccount,
      transactions: newTransactions
    }

    Object.assign(updatedAccount, newAccount)
  }
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

  async function syncAccountWithAddressDescriptor(
    account: Account,
    addressDescriptor: string
  ) {
    setLoading(true)
    setSyncStatus(account.id, 'syncing')

    let updatedAccount: Account = {
      ...account,
      syncStatus: 'syncing',
      transactions: [...account.transactions]
    }

    const progress = {
      tasksDone: account.syncProgress?.tasksDone ?? 0,
      totalTasks: account.syncProgress?.totalTasks ?? 0
    }
    function reportProgress(done: number, added: number) {
      progress.tasksDone += done
      progress.totalTasks += added
      setSyncProgress(account.id, { ...progress })
    }

    try {
      const address = parseAddressDescriptorToAddress(addressDescriptor)
      const snapshot = await fetchAddressSnapshot(
        { backend, network, url },
        address,
        account.transactions,
        reportProgress
      )

      updatedAccount = applyAddressSnapshot(
        updatedAccount,
        address,
        network,
        snapshot
      )
      updatedAccount.syncProgress = { ...progress }
      updatedAccount = updateAccountObjectLabels(updatedAccount)

      const { fiatCurrency } = usePriceStore.getState()

      const timestamps = collectUnpricedTimestamps(
        updatedAccount.transactions,
        fiatCurrency
      )
      const uniqueTimestamps = [...new Set(timestamps)]
      const priceTimestamps = await fetchHistoricalPrices(
        fiatCurrency,
        uniqueTimestamps
      )
      applyHistoricalPrices(updatedAccount, priceTimestamps, fiatCurrency)

      updatedAccount.syncStatus = 'synced'
      updatedAccount.lastSyncedAt = new Date()

      setLoading(false)

      return updatedAccount
    } catch {
      setSyncStatus(account.id, 'error')
      setLoading(false)
      toast.error(`${account.name ?? account.id}: ${t('account.syncFailed')}`)
      return {
        ...updatedAccount,
        syncStatus: 'error'
      }
    }
  }

  async function decryptAccountAddressDescriptors(
    account: Account
  ): Promise<string[]> {
    const secrets = await decryptAccountKeySecrets(account)
    return secrets
      .map((secret) => secret.externalDescriptor || '')
      .filter((descriptor) => descriptor.startsWith('addr'))
  }

  async function syncAccountWithAddress(account: Account): Promise<Account> {
    const latest =
      useAccountsStore.getState().accounts.find((a) => a.id === account.id) ??
      account

    const addressDescriptors = await decryptAccountAddressDescriptors(latest)
    const initialSyncProgress = { tasksDone: 0, totalTasks: 0 }
    let updatedAccount: Account = {
      ...latest,
      syncProgress: initialSyncProgress
    }
    setSyncProgress(updatedAccount.id, initialSyncProgress)

    updatedAccount.summary = {
      ...updatedAccount.summary,
      balance: 0,
      numberOfAddresses: addressDescriptors.length,
      satsInMempool: 0
    }
    updateAccount(updatedAccount)

    for (const addressDescriptor of addressDescriptors) {
      const updatedData = await syncAccountWithAddressDescriptor(
        updatedAccount,
        addressDescriptor
      )

      const newSummary = updatedData.summary

      // Merge account data while preserving the transactions with prices
      updatedAccount = Object.assign(updatedAccount, updatedData, {
        summary: newSummary,
        transactions: updatedData.transactions // Explicitly preserve the transactions with prices
      })

      if (updatedData.syncStatus === 'error') {
        break
      }
    }

    updatedAccount.summary = {
      ...updatedAccount.summary,
      numberOfTransactions: updatedAccount.transactions.length,
      numberOfUtxos: updatedAccount.utxos.length
    }
    updateAccount(updatedAccount)

    return updatedAccount
  }

  return {
    loading,
    syncAccountWithAddress
  }
}

export default useSyncAccountWithAddress
