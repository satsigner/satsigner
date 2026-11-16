import type { Currency } from '@/types/models/Blockchain'
import { resolvePricesAt } from '@/utils/resolveHistoricalPrices'

const MS_PER_SECOND = 1000

// Bundled history has one close per UTC day, so the calendar day the user
// picked is looked up at that day's UTC midnight row.
function getPriceDateTimestamp(date: Date) {
  return (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
    MS_PER_SECOND
  )
}

async function fetchPriceAtTimestamp(
  currency: Currency,
  timestamp: number | undefined
) {
  if (timestamp === undefined) {
    return null
  }
  const prices = await resolvePricesAt(timestamp)
  return prices?.[currency] ?? null
}

export { fetchPriceAtTimestamp, getPriceDateTimestamp }
