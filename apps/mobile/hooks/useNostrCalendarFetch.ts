import { useQuery } from '@tanstack/react-query'

import {
  fetchNostrCalendarData,
  fetchNostrCalendarRsvps
} from '@/api/nostrCalendar'
import { NOSTR_CALENDAR_STALE_TIME_MS } from '@/constants/nostrCalendar'
import { nostrKeys } from '@/db/keys'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import type {
  NostrCalendarData,
  NostrCalendarEvent,
  NostrCalendarRsvp
} from '@/types/models/NostrCalendar'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import {
  getNostrContactsRelaysKey,
  getNostrIdentityRelays
} from '@/utils/nostrContacts'

const EMPTY_CALENDAR_DATA: NostrCalendarData = {
  calendars: [],
  events: [],
  foreignEvents: [],
  invites: [],
  requests: [],
  rsvps: []
}
const NO_RSVPS: NostrCalendarRsvp[] = []

/** The identity, its relays and pubkey, as every calendar screen needs. */
function useNostrCalendarIdentity(npub: string | undefined) {
  const identity = useNostrIdentityStore((state) =>
    state.identities.find((item) => item.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const relays = getNostrIdentityRelays(identity?.relays, globalRelays)
  return {
    canWrite: Boolean(identity?.nsec) && !identity?.isWatchOnly,
    identity,
    ownPubkey: getPubKeyHexFromNpub(npub ?? '') ?? '',
    relayConnected: identity?.relayConnected === true,
    relays,
    relaysKey: getNostrContactsRelaysKey(relays)
  }
}

function useNostrCalendarFetch(npub: string | undefined) {
  const context = useNostrCalendarIdentity(npub)
  const { ownPubkey, relayConnected, relays, relaysKey } = context
  const query = useQuery({
    enabled: Boolean(ownPubkey) && relayConnected && relays.length > 0,
    queryFn: () => fetchNostrCalendarData(relays, ownPubkey),
    queryKey: nostrKeys.identityCalendar(ownPubkey, relaysKey),
    staleTime: NOSTR_CALENDAR_STALE_TIME_MS
  })
  return {
    ...context,
    data: query.data ?? EMPTY_CALENDAR_DATA,
    isError: query.isError,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch
  }
}

function useNostrCalendarRsvpsFetch(
  event: NostrCalendarEvent | undefined,
  relays: string[]
) {
  const query = useQuery({
    enabled: Boolean(event) && relays.length > 0,
    queryFn: () =>
      event
        ? fetchNostrCalendarRsvps(relays, event)
        : Promise.resolve(NO_RSVPS),
    queryKey: nostrKeys.identityCalendarRsvps(
      event?.coordinate ?? '',
      getNostrContactsRelaysKey(relays)
    ),
    staleTime: NOSTR_CALENDAR_STALE_TIME_MS
  })
  return { isLoading: query.isLoading, rsvps: query.data ?? NO_RSVPS }
}

export {
  EMPTY_CALENDAR_DATA,
  useNostrCalendarFetch,
  useNostrCalendarIdentity,
  useNostrCalendarRsvpsFetch
}
