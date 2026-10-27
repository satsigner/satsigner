import { useQuery } from '@tanstack/react-query'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_FEED_STALE_TIME_MS } from '@/constants/nostr'
import { nostrKeys } from '@/db/keys'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'
import { lookupNostrEvent } from '@/utils/nostrNoteDetail'

type UseNostrNoteFetchOptions = {
  eventId: string
  ownPubkeys: string[]
  relays: string[]
}

type UseNostrNoteLookupFetchOptions = UseNostrNoteFetchOptions & {
  fallbackRelaySets: string[][]
}

/**
 * One event by id from the identity's relays (cache first). Relay failures
 * surface as the query error, so "unreachable" is never shown as "not found".
 */
function useNostrNoteFetch({
  eventId,
  ownPubkeys,
  relays
}: UseNostrNoteFetchOptions) {
  return useQuery({
    enabled: eventId.length > 0 && relays.length > 0,
    queryFn: () => new NostrAPI(relays, ownPubkeys).fetchEvent(eventId),
    queryKey: nostrKeys.identityNote(
      eventId,
      getNostrContactsRelaysKey(relays)
    ),
    retry: false,
    staleTime: NOSTR_FEED_STALE_TIME_MS
  })
}

/** Referenced events (quotes, reply parents): own relays, then fallbacks. */
function useNostrNoteLookupFetch({
  eventId,
  fallbackRelaySets,
  ownPubkeys,
  relays
}: UseNostrNoteLookupFetchOptions) {
  return useQuery({
    enabled: eventId.length > 0,
    queryFn: () =>
      lookupNostrEvent(eventId, relays, ownPubkeys, fallbackRelaySets),
    queryKey: nostrKeys.identityNoteLookup(
      eventId,
      getNostrContactsRelaysKey(relays)
    ),
    retry: false,
    staleTime: NOSTR_FEED_STALE_TIME_MS
  })
}

export { useNostrNoteFetch, useNostrNoteLookupFetch }
