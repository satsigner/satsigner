import { MS_PER_SECOND } from '@/constants/time'
import type { Currency } from '@/types/models/Blockchain'
import { resolvePricesAt } from '@/utils/resolveHistoricalPrices'

// Bundled history has one close per UTC day, so the calendar day the user
// picked is looked up at that day's UTC midnight row.
function getPriceDateTimestamp(date: Date) {
  return (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
    MS_PER_SECOND
  )
}

function isSamePriceDay(first: Date, second: Date) {
  return getPriceDateTimestamp(first) === getPriceDateTimestamp(second)
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

export { fetchPriceAtTimestamp, getPriceDateTimestamp, isSamePriceDay }
