import { useQuery } from '@tanstack/react-query'

import { ARK_LNURL_DETAILS_STALE_MS } from '@/constants/ark'
import type { LNURLPayResponse } from '@/types/models/Lightning'
import { decodeLNURL, fetchLNURLPayDetails, isLNURL } from '@/utils/lnurl'

function resolveLnurlUrl(raw: string): string {
  const cleaned = raw.trim().replace(/^lightning:/i, '')
  return isLNURL(cleaned) ? decodeLNURL(cleaned) : cleaned
}

export function useArkLnurlPayDetails(lnurlRaw: string | null | undefined) {
  return useQuery<LNURLPayResponse>({
    enabled: Boolean(lnurlRaw),
    queryFn: () => {
      if (!lnurlRaw) {
        throw new Error('LNURL is required')
      }
      const url = resolveLnurlUrl(lnurlRaw)
      return fetchLNURLPayDetails(url)
    },
    queryKey: ['ark', 'lnurl-pay', 'details', lnurlRaw],
    staleTime: ARK_LNURL_DETAILS_STALE_MS
  })
}
