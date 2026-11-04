import { useQuery } from '@tanstack/react-query'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_FEED_NEW_NOTES_POLL_MS } from '@/constants/nostr'
import { nostrKeys } from '@/db/keys'
import { type NostrFeedNoteLike } from '@/types/models/Nostr'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'
import { filterFeedReplies } from '@/utils/nostrFeed'
import {
  fetchFollowingFeedPage,
  fetchOwnNotesPage,
  kindsForNoteKindFilterId
} from '@/utils/nostrFeedQueries'

type UseNostrNewNotesPollOptions = {
  authors: string[]
  enabled: boolean
  excludeReplies: boolean
  kindFilterId: string
  newestCreatedAt: number
  npub: string
  relays: string[]
  tab: 'feed' | 'notes'
}

const NO_NEW_NOTES: NostrFeedNoteLike[] = []

function initialPollTime() {
  return Date.now()
}

/**
 * Counts notes newer than the newest one shown, on an interval, so the list
 * stays still and offers a "new notes" prompt instead of jumping.
 */
function useNostrNewNotesPoll({
  authors,
  enabled,
  excludeReplies,
  kindFilterId,
  newestCreatedAt,
  npub,
  relays,
  tab
}: UseNostrNewNotesPollOptions) {
  const query = useQuery({
    enabled: enabled && relays.length > 0 && newestCreatedAt > 0,
    initialData: NO_NEW_NOTES,
    initialDataUpdatedAt: initialPollTime,
    queryFn: async () => {
      const api = new NostrAPI(relays)
      const pageQuery = {
        kinds: kindsForNoteKindFilterId(kindFilterId),
        resolveQuotes: false,
        since: newestCreatedAt + 1
      }
      const page =
        tab === 'feed'
          ? await fetchFollowingFeedPage(api, authors, pageQuery)
          : await fetchOwnNotesPage(api, npub, pageQuery)
      return page.data
    },
    queryKey: nostrKeys.identityNewNotes(
      tab,
      npub,
      getNostrContactsRelaysKey(relays),
      kindFilterId,
      newestCreatedAt
    ),
    refetchInterval: NOSTR_FEED_NEW_NOTES_POLL_MS,
    // Count only what the list will show, so hidden replies don't inflate it.
    select: (notes) => filterFeedReplies(notes, excludeReplies).length,
    staleTime: NOSTR_FEED_NEW_NOTES_POLL_MS
  })

  return query.data
}

export { useNostrNewNotesPoll }
