import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { nip19 } from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_PROFILE_CACHE_TTL_SECS } from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { type AuthorProfile } from '@/utils/nostrAuthorDisplay'

async function fetchAuthorProfiles(
  relays: string[],
  hexPubkeys: string[]
): Promise<Record<string, AuthorProfile>> {
  const profiles = await new NostrAPI(relays).fetchKind0Batch(hexPubkeys)
  return Object.fromEntries(
    [...profiles].map(([hex, profile]) => [
      nip19.npubEncode(hex),
      { displayName: profile.displayName, picture: profile.picture }
    ])
  )
}

/** One batched kind-0 fetch for the chat authors that have no profile yet. */
function useNostrDeviceChatProfilesFetch(
  relays: string[],
  missingAuthors: string[]
) {
  const sortedAuthors = missingAuthors.toSorted()
  return useQuery({
    enabled: relays.length > 0 && sortedAuthors.length > 0,
    placeholderData: keepPreviousData,
    queryFn: () => fetchAuthorProfiles(relays, sortedAuthors),
    queryKey: ['nostr', 'device-chat-profiles', relays, sortedAuthors],
    staleTime: NOSTR_PROFILE_CACHE_TTL_SECS * MS_PER_SECOND
  })
}

export { useNostrDeviceChatProfilesFetch }
