import { MempoolOracle } from '@/api/blockchain'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { type Currency } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import { getFiatPriceApiUrl } from '@/utils/fiatData'
import { formatTimestamp } from '@/utils/format'

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
 * Fetch and persist historical fiat prices for transactions that are missing
 * them. Used when the user enables "fetch historical prices" after accounts
 * were already synced.
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

  const oracle = new MempoolOracle(getFiatPriceApiUrl())
  const fetchedPrices = await oracle.getPricesAt(fiatCurrency, uniqueTimestamps)
  const priceByTimestamp: Record<number, number> = {}
  for (const [i, ts] of uniqueTimestamps.entries()) {
    const price = fetchedPrices[i]
    if (price !== undefined) {
      priceByTimestamp[ts] = price
    }
  }

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
