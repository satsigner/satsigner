import { useQuery, useQueryClient } from '@tanstack/react-query'

import { nostrKeys } from '@/db/keys'
import {
  type NostrContactItem,
  type NostrDataSource,
  type NostrErrorCode
} from '@/types/models/Nostr'
import {
  fetchNostrContacts,
  getNostrContactsPlaceholder,
  getNostrContactsRelaysKey,
  type NostrContactsQueryData
} from '@/utils/nostrContacts'

type UseNostrContactsResult = {
  connectedRelayCount: number
  contacts: NostrContactItem[]
  error?: NostrErrorCode
  isError: boolean
  isLoading: boolean
  isRefetching: boolean
  kind3Found: boolean
  refetch: () => void
  relaysQueried: string[]
  source: NostrDataSource
}

export function useNostrContacts(
  npub: string | undefined,
  contactsRelays: string[]
): UseNostrContactsResult {
  const queryClient = useQueryClient()
  const relaysKey = getNostrContactsRelaysKey(contactsRelays)
  const queryKey = nostrKeys.contacts(npub ?? '', relaysKey)

  const enabled = Boolean(npub && contactsRelays.length > 0)

  const query = useQuery({
    enabled,
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
  const failedWithoutData =
    contacts.length === 0 && (query.isError || Boolean(query.data?.error))

  return {
    connectedRelayCount: query.data?.connectedRelayCount ?? 0,
    contacts,
    error: query.data?.error ?? (query.isError ? 'unknown' : undefined),
    isError: failedWithoutData,
    isLoading: query.isLoading && contacts.length === 0,
    isRefetching: query.isFetching && !query.isLoading,
    kind3Found: query.data?.kind3Found ?? false,
    refetch: query.refetch,
    relaysQueried: query.data?.relaysQueried ?? [],
    source: query.data?.source ?? 'relay'
  }
}
