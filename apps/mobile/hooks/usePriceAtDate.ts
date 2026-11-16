import { useQuery } from '@tanstack/react-query'

import { useSettingsStore } from '@/store/settings'
import type { Currency } from '@/types/models/Blockchain'
import {
  fetchPriceAtTimestamp,
  getPriceDateTimestamp
} from '@/utils/priceAtDate'

function usePriceAtDate(date: Date | undefined, currency: Currency) {
  const isHistoricalEnabled = useSettingsStore(
    (state) => state.fetchHistoricalPrices
  )
  const isNetworkEnabled = useSettingsStore(
    (state) => state.fetchHistoricalPricesFromNetwork
  )
  const timestamp = date ? getPriceDateTimestamp(date) : undefined

  const query = useQuery({
    enabled: timestamp !== undefined && isHistoricalEnabled,
    queryFn: () => fetchPriceAtTimestamp(currency, timestamp),
    queryKey: ['priceAtDate', currency, timestamp, isNetworkEnabled],
    staleTime: Number.POSITIVE_INFINITY
  })

  return {
    isHistoricalEnabled,
    isLoading: query.isFetching,
    price: query.data ?? undefined
  }
}

export { usePriceAtDate }
