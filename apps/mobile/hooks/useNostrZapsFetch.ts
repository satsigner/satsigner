import { useInfiniteQuery } from '@tanstack/react-query'

import {
  NOSTR_FEED_PAGE_SIZE,
  NOSTR_FEED_STALE_TIME_MS
} from '@/constants/nostr'
import { nostrKeys } from '@/db/keys'
import type { NostrFetchResult, ZapReceiptInfo } from '@/types/models/Nostr'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'
import {
  getNextZapsPageParam,
  summarizeZapPages
} from '@/utils/nostrFeedQueries'
import { fetchZapsPage } from '@/utils/nostrZap'

type UseNostrZapsFetchOptions = {
  enabled: boolean
  ownPubkeys: string[]
  pubkeyHex: string
  relays: string[]
}

const ZAPS_HEAD_PAGE_PARAM = 0

/** Zaps received and sent by a profile, newest first, paged with `until`. */
function useNostrZapsFetch({
  enabled,
  ownPubkeys,
  pubkeyHex,
  relays
}: UseNostrZapsFetchOptions) {
  const query = useInfiniteQuery({
    enabled: enabled && relays.length > 0 && pubkeyHex.length > 0,
    getNextPageParam: (
      _lastPage,
      pages: NostrFetchResult<ZapReceiptInfo[]>[],
      lastPageParam: number
    ) =>
      getNextZapsPageParam(
        pages,
        lastPageParam === ZAPS_HEAD_PAGE_PARAM ? undefined : lastPageParam
      ),
    initialPageParam: ZAPS_HEAD_PAGE_PARAM,
    queryFn: ({ pageParam }) =>
      fetchZapsPage({
        limit: NOSTR_FEED_PAGE_SIZE,
        ownPubkeys,
        pubkeyHex,
        relays,
        until: pageParam || undefined
      }),
    queryKey: nostrKeys.identityZaps(
      pubkeyHex,
      getNostrContactsRelaysKey(relays)
    ),
    staleTime: NOSTR_FEED_STALE_TIME_MS
  })

  return {
    ...summarizeZapPages(query.data?.pages ?? []),
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
    refetch: query.refetch
  }
}

export { useNostrZapsFetch }
