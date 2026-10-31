import { useQuery } from '@tanstack/react-query'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_FOLLOWS_STALE_TIME_MS } from '@/constants/nostr'
import { nostrKeys } from '@/db/keys'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'

type UseNostrFollowsFetchOptions = {
  enabled: boolean
  npub: string
  relays: string[]
}

/** The identity's kind 3 follow list; falls back to the cached list offline. */
function useNostrFollowsFetch({
  enabled,
  npub,
  relays
}: UseNostrFollowsFetchOptions) {
  return useQuery({
    enabled: enabled && relays.length > 0,
    queryFn: () => new NostrAPI(relays).fetchKind3FollowingPubkeys(npub),
    queryKey: nostrKeys.identityFollows(
      npub,
      getNostrContactsRelaysKey(relays)
    ),
    staleTime: NOSTR_FOLLOWS_STALE_TIME_MS
  })
}

export { useNostrFollowsFetch }
