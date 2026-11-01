import { useQuery } from '@tanstack/react-query'

import { NOSTR_FEED_STALE_TIME_MS } from '@/constants/nostr'
import { nostrKeys } from '@/db/keys'
import { requestWindowProfiles } from '@/hooks/useNostrVisibleItemsTrack'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'
import { fetchZapReceipts } from '@/utils/nostrZap'

type UseNostrNoteZapsFetchOptions = {
  enabled: boolean
  eventId: string
  ownPubkeys: string[]
  relays: string[]
}

/**
 * Zap receipts for one note (cached first, then newer from relays). Sender
 * profiles are queued on the shared batcher as soon as receipts arrive.
 */
function useNostrNoteZapsFetch({
  enabled,
  eventId,
  ownPubkeys,
  relays
}: UseNostrNoteZapsFetchOptions) {
  return useQuery({
    enabled: enabled && eventId.length > 0 && relays.length > 0,
    queryFn: async () => {
      const result = await fetchZapReceipts(eventId, relays, ownPubkeys)
      void requestWindowProfiles(
        result.data.map((receipt) => receipt.senderPubkey),
        relays
      )
      return result
    },
    queryKey: nostrKeys.identityNoteZaps(
      eventId,
      getNostrContactsRelaysKey(relays)
    ),
    staleTime: NOSTR_FEED_STALE_TIME_MS
  })
}

export { useNostrNoteZapsFetch }
