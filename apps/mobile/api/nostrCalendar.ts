import * as nostrKinds from 'nostr-tools/kinds'

import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_CALENDAR_DELETIONS_FETCH_LIMIT,
  NOSTR_CALENDAR_EVENT_KINDS,
  NOSTR_CALENDAR_FETCH_LIMIT,
  NOSTR_CALENDAR_INVITES_FETCH_LIMIT,
  NOSTR_CALENDAR_MAX_FILTER_VALUES,
  NOSTR_CALENDAR_OWN_KINDS,
  NOSTR_CALENDAR_REFERENCED_FILTERS_MAX,
  NOSTR_CALENDAR_RSVPS_FETCH_LIMIT
} from '@/constants/nostrCalendar'
import type {
  NostrCalendarData,
  NostrCalendarEventTemplate,
  NostrCalendarRsvp
} from '@/types/models/NostrCalendar'
import {
  buildCalendarData,
  getCalendarCoordinate,
  getCalendarDeletions,
  getReferencedEventFilters,
  parseCalendar,
  parseCalendarRsvp,
  parseLiveItems
} from '@/utils/nostrCalendar'

type NostrRawEvents = Awaited<ReturnType<NostrAPI['fetchEvents']>>

const NO_EVENTS: NostrRawEvents = []

function withApi<T>(relays: string[], run: (api: NostrAPI) => Promise<T>) {
  const api = new NostrAPI(relays)
  return run(api).finally(() => api.disconnect())
}

function getOwnCalendarCoordinates(own: NostrRawEvents) {
  return own
    .flatMap((event) => {
      const calendar = parseCalendar(event)
      return calendar ? [calendar.coordinate] : []
    })
    .slice(0, NOSTR_CALENDAR_MAX_FILTER_VALUES)
}

/**
 * Own NIP-52 events. RSVPs get their own request, so a long RSVP history
 * can't fill the limit and push older calendar events out.
 */
async function fetchOwnEvents(api: NostrAPI, ownPubkey: string) {
  const lists = await Promise.all([
    api.fetchEvents({
      authors: [ownPubkey],
      kinds: NOSTR_CALENDAR_OWN_KINDS,
      limit: NOSTR_CALENDAR_FETCH_LIMIT
    }),
    api.fetchEvents({
      authors: [ownPubkey],
      kinds: [nostrKinds.CalendarEventRSVP],
      limit: NOSTR_CALENDAR_RSVPS_FETCH_LIMIT
    })
  ])
  return lists.flat()
}

/**
 * Events by others that own calendars list. They may neither tag this
 * identity nor name the calendar, so only their coordinates find them.
 */
function fetchReferencedEvents(
  api: NostrAPI,
  own: NostrRawEvents,
  ownPubkey: string,
  deletions: NostrRawEvents
): Promise<NostrRawEvents>[] {
  return getReferencedEventFilters(own, ownPubkey, deletions)
    .slice(0, NOSTR_CALENDAR_REFERENCED_FILTERS_MAX)
    .map((group) =>
      api.fetchEvents({
        '#d': group
          .map((parts) => parts.dTag)
          .slice(0, NOSTR_CALENDAR_MAX_FILTER_VALUES),
        authors: [group[0].pubkey],
        kinds: [group[0].kind],
        limit: NOSTR_CALENDAR_INVITES_FETCH_LIMIT
      })
    )
}

/**
 * Calendar events by others: invites that tag this identity, requests to
 * join one of its calendars, and events its calendars list. They are extra,
 * so an outage returns nothing instead of hiding own events.
 */
async function fetchForeignEvents(
  api: NostrAPI,
  ownPubkey: string,
  own: NostrRawEvents,
  ownDeletions: NostrRawEvents
) {
  const calendarCoordinates = getOwnCalendarCoordinates(own)
  const invites = api.fetchEvents({
    '#p': [ownPubkey],
    kinds: NOSTR_CALENDAR_EVENT_KINDS,
    limit: NOSTR_CALENDAR_INVITES_FETCH_LIMIT
  })
  const requests =
    calendarCoordinates.length === 0
      ? Promise.resolve(NO_EVENTS)
      : api.fetchEvents({
          '#a': calendarCoordinates,
          kinds: NOSTR_CALENDAR_EVENT_KINDS,
          limit: NOSTR_CALENDAR_INVITES_FETCH_LIMIT
        })
  const referenced = fetchReferencedEvents(api, own, ownPubkey, ownDeletions)
  const lists = await Promise.allSettled([invites, requests, ...referenced])
  return lists.flatMap((list) =>
    list.status === 'fulfilled' ? list.value : NO_EVENTS
  )
}

function fetchDeletions(api: NostrAPI, authors: string[]) {
  return api.fetchEvents({
    authors: authors.slice(0, NOSTR_CALENDAR_MAX_FILTER_VALUES),
    kinds: [nostrKinds.EventDeletion],
    limit: NOSTR_CALENDAR_DELETIONS_FETCH_LIMIT
  })
}

/**
 * Own NIP-52 events (calendar events, calendars, RSVPs), events by others
 * that invite this identity, ask to join its calendars or are listed in
 * them, and the NIP-09 deletions that hide revisions of them.
 *
 * A failed deletion lookup fails the refresh: without it a deleted event
 * would come back as live. The query keeps the last good data meanwhile.
 */
export function fetchNostrCalendarData(
  relays: string[],
  ownPubkey: string
): Promise<NostrCalendarData> {
  return withApi(relays, async (api) => {
    const [own, ownDeletions] = await Promise.all([
      fetchOwnEvents(api, ownPubkey),
      fetchDeletions(api, [ownPubkey])
    ])
    const foreign = await fetchForeignEvents(api, ownPubkey, own, ownDeletions)
    const foreignAuthors = [
      ...new Set(foreign.map((event) => event.pubkey.toLowerCase()))
    ].filter((pubkey) => pubkey !== ownPubkey)
    const foreignDeletions =
      foreignAuthors.length === 0
        ? NO_EVENTS
        : await fetchDeletions(api, foreignAuthors)
    return buildCalendarData({
      deletions: [...ownDeletions, ...foreignDeletions],
      foreign,
      own,
      ownPubkey
    })
  })
}

/** Deletions naming one of `rsvps`, by id or by coordinate. */
async function fetchRsvpDeletions(api: NostrAPI, rsvps: NostrRawEvents) {
  if (rsvps.length === 0) {
    return NO_EVENTS
  }
  const parsed = rsvps.flatMap((item) => {
    const rsvp = parseCalendarRsvp(item)
    return rsvp ? [rsvp] : []
  })
  const base = {
    authors: [...new Set(parsed.map((rsvp) => rsvp.pubkey))].slice(
      0,
      NOSTR_CALENDAR_MAX_FILTER_VALUES
    ),
    kinds: [nostrKinds.EventDeletion],
    limit: NOSTR_CALENDAR_DELETIONS_FETCH_LIMIT
  }
  const coordinates = [...new Set(parsed.map((rsvp) => rsvp.coordinate))]
  const ids = parsed.map((rsvp) => rsvp.id)
  const lists = await Promise.all([
    api.fetchEvents({
      ...base,
      '#a': coordinates.slice(0, NOSTR_CALENDAR_MAX_FILTER_VALUES)
    }),
    api.fetchEvents({
      ...base,
      '#e': ids.slice(0, NOSTR_CALENDAR_MAX_FILTER_VALUES)
    })
  ])
  return lists.flat()
}

/**
 * Every live RSVP to a calendar event, from any author. Deletions by each
 * responder are applied first, so a withdrawn answer isn't counted. A failed
 * deletion lookup fails the fetch rather than count withdrawn answers.
 */
export function fetchNostrCalendarRsvps(
  relays: string[],
  event: { dTag: string; kind: number; pubkey: string }
): Promise<NostrCalendarRsvp[]> {
  const coordinate = getCalendarCoordinate(event.kind, event.pubkey, event.dTag)
  return withApi(relays, async (api) => {
    const raw = await api.fetchEvents({
      '#a': [coordinate],
      kinds: [nostrKinds.CalendarEventRSVP],
      limit: NOSTR_CALENDAR_FETCH_LIMIT
    })
    const rsvps = raw.filter(
      (item) => parseCalendarRsvp(item)?.eventCoordinate === coordinate
    )
    const deletions = await fetchRsvpDeletions(api, rsvps)
    return parseLiveItems(
      rsvps,
      parseCalendarRsvp,
      getCalendarDeletions(deletions)
    )
  })
}

export function publishNostrCalendarTemplate(
  relays: string[],
  nsec: string,
  template: NostrCalendarEventTemplate
) {
  return withApi(relays, (api) => api.publishTemplate(nsec, template))
}

/**
 * A batch that stopped part way. `published` went out before `cause`, so the
 * caller can keep their effects and retry only the rest.
 */
export class NostrCalendarPartialPublishError extends Error {
  readonly cause: unknown
  readonly published: NostrRawEvents

  constructor(cause: unknown, published: NostrRawEvents) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'NostrCalendarPartialPublishError'
    this.cause = cause
    this.published = published
  }
}

/**
 * Publishes several templates in order, e.g. an event then its calendars.
 * A failure after the first throws a NostrCalendarPartialPublishError.
 */
export function publishNostrCalendarTemplates(
  relays: string[],
  nsec: string,
  templates: NostrCalendarEventTemplate[]
) {
  return withApi(relays, async (api) => {
    const published: NostrRawEvents = []
    for (const template of templates) {
      try {
        // oxlint-disable-next-line no-await-in-loop -- one relay pool, in order
        published.push(await api.publishTemplate(nsec, template))
      } catch (error) {
        throw published.length === 0
          ? error
          : new NostrCalendarPartialPublishError(error, published)
      }
    }
    return published
  })
}
