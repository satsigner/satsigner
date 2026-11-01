import { useQuery } from '@tanstack/react-query'

import { fetchProfilesCoalesced } from '@/api/nostrProfileFetcher'
import { NOSTR_PROFILE_QUERY_STALE_TIME_MS } from '@/constants/nostr'
import { nostrKeys } from '@/db/keys'
import type { NostrKind0Profile } from '@/types/models/Nostr'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'

const NO_PROFILES: Record<string, NostrKind0Profile | null> = {}

/** Kind 0 profiles for a fixed set of pubkeys (e.g. mentions in one note). */
function useNostrProfilesFetch(pubkeys: string[], relays: string[]) {
  const query = useQuery({
    enabled: pubkeys.length > 0,
    queryFn: async () => {
      const found = await fetchProfilesCoalesced(pubkeys, relays)
      return Object.fromEntries(
        pubkeys.map((pk) => [pk, found.get(pk.toLowerCase()) ?? null])
      )
    },
    queryKey: nostrKeys.identityPubkeyProfiles(
      pubkeys.join(','),
      getNostrContactsRelaysKey(relays)
    ),
    staleTime: NOSTR_PROFILE_QUERY_STALE_TIME_MS
  })
  return query.data ?? NO_PROFILES
}

export { useNostrProfilesFetch }
