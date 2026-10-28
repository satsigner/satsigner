import {
  useInfiniteQuery,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_BOOKMARKS_FILTER_IDS,
  NOSTR_FEED_STALE_TIME_MS
} from '@/constants/nostr'
import { nostrKeys } from '@/db/keys'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'
import {
  FEED_HEAD_PAGE_PARAM,
  fetchBookmarkNotes,
  fetchOwnNotesPage,
  getNextNotesPageParam,
  kindsForNoteKindFilterId,
  type NostrFeedNotesPage,
  summarizeFeedPages
} from '@/utils/nostrFeedQueries'

type UseNostrNotesFetchOptions = {
  enabled: boolean
  kindFilterId: string
  npub: string
  nsec?: string
  relays: string[]
  resolveQuotes: boolean
}

const BOOKMARKS_QUERY_KEY_SEGMENT = 'bookmarks'
const EMPTY_PRIVATE_IDS = new Set<string>()

/**
 * The identity's own notes for the notes tab, paged with `until`. Bookmark
 * filters load the NIP-51 list in one batch instead.
 */
function useNostrNotesFetch({
  enabled,
  kindFilterId,
  npub,
  nsec,
  relays,
  resolveQuotes
}: UseNostrNotesFetchOptions) {
  const hexPubkey = getPubKeyHexFromNpub(npub) ?? ''
  const ownPubkeys = hexPubkey ? [hexPubkey] : []
  const relaysKey = getNostrContactsRelaysKey(relays)
  const isBookmarks = NOSTR_BOOKMARKS_FILTER_IDS.has(kindFilterId)
  const canFetch = enabled && relays.length > 0
  const queryClient = useQueryClient()
  const queryKey = nostrKeys.identityNotes(npub, relaysKey, kindFilterId)

  function showNewest() {
    void queryClient.resetQueries({ queryKey })
  }

  const notesQuery = useInfiniteQuery({
    enabled: canFetch && !isBookmarks,
    getNextPageParam: (
      _lastPage,
      pages: NostrFeedNotesPage[],
      lastPageParam: number
    ) => getNextNotesPageParam(pages, lastPageParam),
    initialPageParam: FEED_HEAD_PAGE_PARAM,
    queryFn: ({ pageParam }) =>
      fetchOwnNotesPage(new NostrAPI(relays, ownPubkeys), npub, {
        kinds: kindsForNoteKindFilterId(kindFilterId),
        resolveQuotes,
        until: pageParam || undefined
      }),
    queryKey,
    staleTime: NOSTR_FEED_STALE_TIME_MS
  })

  const bookmarksQuery = useQuery({
    enabled: canFetch && isBookmarks,
    queryFn: () =>
      fetchBookmarkNotes(new NostrAPI(relays, ownPubkeys), {
        filterId: kindFilterId,
        hexPubkey,
        npub,
        nsec,
        resolveQuotes
      }),
    queryKey: [...queryKey, BOOKMARKS_QUERY_KEY_SEGMENT],
    staleTime: NOSTR_FEED_STALE_TIME_MS
  })

  if (isBookmarks) {
    return {
      error: bookmarksQuery.data?.error,
      fetchNextPage: notesQuery.fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: bookmarksQuery.isLoading,
      isRefetching: bookmarksQuery.isRefetching,
      notes: bookmarksQuery.data?.data ?? [],
      privateIds: bookmarksQuery.data?.privateIds ?? EMPTY_PRIVATE_IDS,
      refetch: bookmarksQuery.refetch,
      resolved: bookmarksQuery.data?.resolved ?? new Map(),
      showNewest,
      source: bookmarksQuery.data?.source ?? 'relay'
    }
  }

  const summary = summarizeFeedPages(notesQuery.data?.pages ?? [])
  return {
    ...summary,
    fetchNextPage: notesQuery.fetchNextPage,
    hasNextPage: notesQuery.hasNextPage,
    isFetchingNextPage: notesQuery.isFetchingNextPage,
    isLoading: notesQuery.isLoading,
    isRefetching: notesQuery.isRefetching && !notesQuery.isFetchingNextPage,
    privateIds: EMPTY_PRIVATE_IDS,
    refetch: notesQuery.refetch,
    showNewest
  }
}

export { useNostrNotesFetch }
