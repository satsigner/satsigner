import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { type Currency } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import { formatTimestamp } from '@/utils/format'
import { resolveHistoricalPrices } from '@/utils/resolveHistoricalPrices'

function txNeedsHistoricalPrice(
  tx: Transaction,
  currency: Currency
): tx is Transaction & { timestamp: Date } {
  if (!tx.timestamp) {
    return false
  }
  const timestamp =
    tx.timestamp instanceof Date ? tx.timestamp : new Date(tx.timestamp)
  if (Number.isNaN(timestamp.getTime())) {
    return false
  }
  return tx.prices?.[currency] === undefined
}

/**
 * Resolve and persist historical fiat prices for transactions that are missing
 * them. Uses bundled prices; network only if the user opted in.
 */
async function backfillHistoricalPrices(): Promise<void> {
  if (!useSettingsStore.getState().fetchHistoricalPrices) {
    return
  }

  const { fiatCurrency } = usePriceStore.getState()
  const { accounts, updateAccount } = useAccountsStore.getState()

  const timestamps: number[] = []
  for (const account of accounts) {
    for (const tx of account.transactions) {
      if (!txNeedsHistoricalPrice(tx, fiatCurrency)) {
        continue
      }
      const timestamp =
        tx.timestamp instanceof Date ? tx.timestamp : new Date(tx.timestamp)
      timestamps.push(formatTimestamp(timestamp))
    }
  }

  const uniqueTimestamps = [...new Set(timestamps)]
  if (uniqueTimestamps.length === 0) {
    return
  }

  const priceByTimestamp = await resolveHistoricalPrices(
    fiatCurrency,
    uniqueTimestamps
  )

  for (const account of accounts) {
    let changed = false
    const transactions = account.transactions.map((tx) => {
      if (!txNeedsHistoricalPrice(tx, fiatCurrency)) {
        return tx
      }
      const timestamp =
        tx.timestamp instanceof Date ? tx.timestamp : new Date(tx.timestamp)
      const price = priceByTimestamp[formatTimestamp(timestamp)]
      if (price === undefined) {
        return tx
      }
      changed = true
      return {
        ...tx,
        prices: { ...tx.prices, [fiatCurrency]: price },
        timestamp
      }
    })

    if (changed) {
      updateAccount({ ...account, transactions })
    }
  }
}

export { backfillHistoricalPrices }
