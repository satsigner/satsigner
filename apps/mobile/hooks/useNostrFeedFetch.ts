import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient
} from '@tanstack/react-query'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_FEED_STALE_TIME_MS } from '@/constants/nostr'
import { nostrKeys } from '@/db/keys'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'
import {
  FEED_HEAD_PAGE_PARAM,
  fetchFollowingFeedPage,
  getNextNotesPageParam,
  kindsForNoteKindFilterId,
  type NostrFeedNotesPage,
  summarizeFeedPages
} from '@/utils/nostrFeedQueries'

type UseNostrFeedFetchOptions = {
  authors: string[]
  enabled: boolean
  followsUpdatedAt: number
  kindFilterId: string
  npub: string
  relays: string[]
  resolveQuotes: boolean
}

/** Notes from the follow list for the feed tab, paged with `until`. */
function useNostrFeedFetch({
  authors,
  enabled,
  followsUpdatedAt,
  kindFilterId,
  npub,
  relays,
  resolveQuotes
}: UseNostrFeedFetchOptions) {
  const hexPubkey = getPubKeyHexFromNpub(npub) ?? ''
  const ownPubkeys = hexPubkey ? [hexPubkey] : []
  const queryClient = useQueryClient()
  const queryKey = [
    ...nostrKeys.identityFeed(
      npub,
      getNostrContactsRelaysKey(relays),
      kindFilterId
    ),
    followsUpdatedAt
  ]

  function showNewest() {
    void queryClient.resetQueries({ queryKey })
  }

  const query = useInfiniteQuery({
    enabled: enabled && relays.length > 0 && authors.length > 0,
    getNextPageParam: (
      _lastPage,
      pages: NostrFeedNotesPage[],
      lastPageParam: number
    ) => getNextNotesPageParam(pages, lastPageParam),
    initialPageParam: FEED_HEAD_PAGE_PARAM,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      fetchFollowingFeedPage(new NostrAPI(relays, ownPubkeys), authors, {
        kinds: kindsForNoteKindFilterId(kindFilterId),
        resolveQuotes,
        until: pageParam || undefined
      }),
    queryKey,
    staleTime: NOSTR_FEED_STALE_TIME_MS
  })

  return {
    ...summarizeFeedPages(query.data?.pages ?? []),
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
    refetch: query.refetch,
    showNewest
  }
}

export { useNostrFeedFetch }
