import { type ViewToken } from '@shopify/flash-list'

import { fetchProfilesCoalesced } from '@/api/nostrProfileFetcher'
import { useNostrProfilesStore } from '@/store/nostrProfiles'
import {
  collectWindowPubkeys,
  getVisibleWindowRange
} from '@/utils/nostrVisibleWindow'

type UseNostrVisibleItemsTrackOptions<T> = {
  enabled: boolean
  getPubkeys: (item: T) => string[]
  items: T[]
  /** Visible items in on-screen order, e.g. to pick the video that plays. */
  onVisibleItems?: (visible: T[]) => void
  relays: string[]
}

type ViewableItemsChangedInfo<T> = {
  changed: ViewToken<T>[]
  viewableItems: ViewToken<T>[]
}

const loadingPubkeys = new Set<string>()

/**
 * Sends the pubkeys not yet loaded (or loading) to the profile batcher and
 * publishes the answers to the in-memory profile store.
 */
async function requestWindowProfiles(
  pubkeys: string[],
  relays: string[]
): Promise<void> {
  const { profiles } = useNostrProfilesStore.getState()
  const wanted = pubkeys.filter(
    (pk) => !profiles[pk] && !loadingPubkeys.has(pk)
  )
  if (wanted.length === 0) {
    return
  }
  for (const pk of wanted) {
    loadingPubkeys.add(pk)
  }
  try {
    const found = await fetchProfilesCoalesced(wanted, relays)
    useNostrProfilesStore.getState().setProfiles(wanted, found)
  } finally {
    for (const pk of wanted) {
      loadingPubkeys.delete(pk)
    }
  }
}

function getViewableIndices<T>(tokens: ViewToken<T>[]): number[] {
  return tokens.flatMap((token) =>
    token.isViewable && token.index !== null ? [token.index] : []
  )
}

/**
 * Turns FlashList viewability into profile loads for the visible rows plus
 * a window ahead and behind, instead of loading every author in the list.
 * Pass the returned handler as `onViewableItemsChanged`.
 */
function useNostrVisibleItemsTrack<T>({
  enabled,
  getPubkeys,
  items,
  onVisibleItems,
  relays
}: UseNostrVisibleItemsTrackOptions<T>) {
  function onViewableItemsChanged({
    viewableItems
  }: ViewableItemsChangedInfo<T>) {
    onVisibleItems?.(
      viewableItems.flatMap((token) =>
        token.isViewable && token.item !== undefined ? [token.item] : []
      )
    )
    if (!enabled) {
      return
    }
    const range = getVisibleWindowRange(
      getViewableIndices(viewableItems),
      items.length
    )
    const pubkeys = collectWindowPubkeys(items, range, getPubkeys)
    if (pubkeys.length > 0) {
      void requestWindowProfiles(pubkeys, relays)
    }
  }

  return { onViewableItemsChanged }
}

export { requestWindowProfiles, useNostrVisibleItemsTrack }
