import { useInfiniteQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_FEED_STALE_TIME_MS,
  NOSTR_REACTIONS_PAGE_SIZE
} from '@/constants/nostr'
import { nostrKeys } from '@/db/keys'
import { requestWindowProfiles } from '@/hooks/useNostrVisibleItemsTrack'
import { pickNostrProfiles, useNostrProfilesStore } from '@/store/nostrProfiles'
import { type NostrReactionsPage } from '@/types/models/Nostr'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'
import {
  getNextReactionsUntil,
  summarizeReactions,
  toReactionItems,
  toReactionRow
} from '@/utils/nostrReactions'

type UseNostrNoteReactionsFetchOptions = {
  enabled: boolean
  eventId: string
  relays: string[]
}

const REACTIONS_HEAD_PAGE_PARAM = 0

async function fetchReactionsPage(
  eventId: string,
  relays: string[],
  until: number | undefined
) {
  const api = new NostrAPI(relays)
  try {
    const page = await api.fetchNoteReactions(eventId, {
      limit: NOSTR_REACTIONS_PAGE_SIZE,
      until
    })
    void requestWindowProfiles(
      page.reactions.map((reaction) => reaction.pubkey),
      relays
    )
    return page
  } finally {
    api.disconnect()
  }
}

/**
 * Everyone's reactions to one note, one per author, newest first, paged
 * backwards with `until`. Author profiles go through the shared batcher.
 */
function useNostrNoteReactionsFetch({
  enabled,
  eventId,
  relays
}: UseNostrNoteReactionsFetchOptions) {
  const query = useInfiniteQuery({
    enabled: enabled && eventId.length > 0 && relays.length > 0,
    getNextPageParam: (lastPage: NostrReactionsPage) =>
      getNextReactionsUntil(lastPage, NOSTR_REACTIONS_PAGE_SIZE),
    initialPageParam: REACTIONS_HEAD_PAGE_PARAM,
    queryFn: ({ pageParam }) =>
      fetchReactionsPage(eventId, relays, pageParam || undefined),
    queryKey: nostrKeys.identityNoteReactions(
      eventId,
      getNostrContactsRelaysKey(relays)
    ),
    staleTime: NOSTR_FEED_STALE_TIME_MS
  })

  const items = toReactionItems(
    query.data?.pages.flatMap((page) => page.reactions) ?? []
  )
  const profiles = useNostrProfilesStore(
    useShallow((state) =>
      pickNostrProfiles(
        state.profiles,
        items.map((item) => item.authorPubkey)
      )
    )
  )

  return {
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    rows: items.map((item) =>
      toReactionRow(item, profiles[item.authorPubkey.toLowerCase()])
    ),
    summary: summarizeReactions(items.map((item) => item.reaction))
  }
}

export { useNostrNoteReactionsFetch }
