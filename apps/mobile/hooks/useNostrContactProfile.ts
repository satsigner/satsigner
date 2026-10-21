import { skipToken, useQuery } from '@tanstack/react-query'

import { NostrAPI } from '@/api/nostr'
import { time } from '@/utils/time'

/** Kind 0 profile of a contact, fetched from the given relays. */
export function useNostrContactProfile(
  npub: string | undefined,
  relays: string[],
  enabled: boolean
) {
  const canFetch = enabled && !!npub && relays.length > 0
  return useQuery({
    queryFn: canFetch ? () => new NostrAPI(relays).fetchKind0(npub) : skipToken,
    queryKey: ['nostr', 'contact-profile', npub, relays],
    retry: false,
    staleTime: time.minutes(1)
  })
}
