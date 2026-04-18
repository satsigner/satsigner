import { useQuery } from '@tanstack/react-query'

import type { LNDRequest } from '@/types/models/LND'
import { fetchChannelHistoryRows } from '@/utils/lndChannelHistory'

function useLndChannelHistoryQuery(
  makeRequest: LNDRequest,
  chanIdDecoded: string,
  enabled: boolean
) {
  return useQuery({
    enabled: enabled && chanIdDecoded.length > 0,
    queryFn: () => fetchChannelHistoryRows(makeRequest, chanIdDecoded),
    queryKey: ['lnd', 'channelHistory', chanIdDecoded]
  })
}

export { useLndChannelHistoryQuery }
