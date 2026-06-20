import { useQuery, useQueryClient } from '@tanstack/react-query'

import { nostrKeys } from '@/db/keys'
import { getNostrFollowCache } from '@/storage/mmkv'
import { type NostrContactItem } from '@/types/models/Nostr'
import {
  fetchNostrContacts,
  getNostrContactsPlaceholder,
  getNostrContactsRelaysKey,
  type NostrContactsQueryData
} from '@/utils/nostrContacts'

type UseNostrContactsResult = {
  connectedRelayCount: number
  contacts: NostrContactItem[]
  isError: boolean
  isLoading: boolean
  kind3Found: boolean
  relaysQueried: string[]
}

export function useNostrContacts(
  npub: string | undefined,
  contactsRelays: string[]
): UseNostrContactsResult {
  const queryClient = useQueryClient()
  const relaysKey = getNostrContactsRelaysKey(contactsRelays)
  const queryKey = nostrKeys.contacts(npub ?? '', relaysKey)
  const hasFollowCache = Boolean(npub && getNostrFollowCache(npub)?.length)

  const query = useQuery({
    enabled: Boolean(npub && contactsRelays.length > 0),
    placeholderData: npub ? getNostrContactsPlaceholder(npub) : undefined,
    queryFn: ({ signal }) => {
      if (!npub) {
        throw new Error('npub is required')
      }
      return fetchNostrContacts(npub, contactsRelays, {
        onProfileBatch: (contacts) => {
          queryClient.setQueryData(
            queryKey,
            (current: NostrContactsQueryData | undefined) =>
              current ? { ...current, contacts } : current
          )
        },
        signal
      })
    },
    queryKey
  })

  const contacts = query.data?.contacts ?? []
  const showFetchError = query.isError && !hasFollowCache && contacts.length === 0

  return {
    connectedRelayCount: query.data?.connectedRelayCount ?? 0,
    contacts,
    isError: showFetchError,
    isLoading: query.isLoading && contacts.length === 0,
    kind3Found: query.data?.kind3Found ?? false,
    relaysQueried: query.data?.relaysQueried ?? []
  }
}
