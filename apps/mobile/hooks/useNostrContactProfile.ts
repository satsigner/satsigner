import { useQuery } from '@tanstack/react-query'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_CONTACT_PROFILE_STALE_TIME_MS } from '@/constants/nostr'

/** Kind 0 profile of a contact, fetched from the given relays. */
export function useNostrContactProfile(
  npub: string | undefined,
  relays: string[],
  enabled: boolean
) {
  return useQuery({
    enabled: enabled && Boolean(npub) && relays.length > 0,
    queryFn: () => new NostrAPI(relays).fetchKind0(npub ?? ''),
    queryKey: ['nostr', 'contact-profile', npub, relays],
    staleTime: NOSTR_CONTACT_PROFILE_STALE_TIME_MS
  })
}
