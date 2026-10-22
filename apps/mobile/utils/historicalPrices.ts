import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { type Currency } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import { toValidDate } from '@/utils/date'
import { formatTimestamp } from '@/utils/format'
import { resolveHistoricalPrices } from '@/utils/resolveHistoricalPrices'

function dateNeedingHistoricalPrice(tx: Transaction, currency: Currency) {
  if (tx.prices?.[currency] !== undefined) {
    return null
  }
  return toValidDate(tx.timestamp)
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
      const date = dateNeedingHistoricalPrice(tx, fiatCurrency)
      if (!date) {
        continue
      }
      timestamps.push(formatTimestamp(date))
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
      const date = dateNeedingHistoricalPrice(tx, fiatCurrency)
      if (!date) {
        return tx
      }
      const price = priceByTimestamp[formatTimestamp(date)]
      if (price === undefined) {
        return tx
      }
      changed = true
      return {
        ...tx,
        prices: { ...tx.prices, [fiatCurrency]: price },
        timestamp: date
      }
    })

    if (changed) {
      updateAccount({ ...account, transactions })
    }
  }
}

export { backfillHistoricalPrices }
