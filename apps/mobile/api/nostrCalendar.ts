import * as nostrKinds from 'nostr-tools/kinds'

import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_CALENDAR_DELETIONS_FETCH_LIMIT,
  NOSTR_CALENDAR_EVENT_KINDS,
  NOSTR_CALENDAR_FETCH_LIMIT,
  NOSTR_CALENDAR_INVITES_FETCH_LIMIT,
  NOSTR_CALENDAR_MAX_FILTER_VALUES,
  NOSTR_CALENDAR_OWN_KINDS
} from '@/constants/nostrCalendar'
import type {
  NostrCalendarData,
  NostrCalendarEventTemplate,
  NostrCalendarRsvp
} from '@/types/models/NostrCalendar'
import {
  buildCalendarData,
  getCalendarCoordinate,
  parseCalendar,
  parseCalendarRsvp
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
 * Calendar events by others: invites that tag this identity and requests to
 * join one of its calendars. They are extra, so an outage returns nothing
 * instead of hiding own events.
 */
async function fetchForeignEvents(
  api: NostrAPI,
  ownPubkey: string,
  calendarCoordinates: string[]
) {
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
  const lists = await Promise.allSettled([invites, requests])
  return lists.flatMap((list) =>
    list.status === 'fulfilled' ? list.value : NO_EVENTS
  )
}

/**
 * Own NIP-52 events (calendar events, calendars, RSVPs), events by others
 * that invite this identity or ask to join its calendars, and the NIP-09
 * deletions that hide revisions of them.
 */
export function fetchNostrCalendarData(
  relays: string[],
  ownPubkey: string
): Promise<NostrCalendarData> {
  return withApi(relays, async (api) => {
    const own = await api.fetchEvents({
      authors: [ownPubkey],
      kinds: NOSTR_CALENDAR_OWN_KINDS,
      limit: NOSTR_CALENDAR_FETCH_LIMIT
    })
    const foreign = await fetchForeignEvents(
      api,
      ownPubkey,
      getOwnCalendarCoordinates(own)
    )
    const authors = [
      ownPubkey,
      ...new Set(foreign.map((event) => event.pubkey))
    ].slice(0, NOSTR_CALENDAR_MAX_FILTER_VALUES)
    const deletions = await api
      .fetchEvents({
        authors,
        kinds: [nostrKinds.EventDeletion],
        limit: NOSTR_CALENDAR_DELETIONS_FETCH_LIMIT
      })
      .catch(() => NO_EVENTS)
    return buildCalendarData({ deletions, foreign, own, ownPubkey })
  })
}

/** Every RSVP to a calendar event, from any author. */
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
    return raw.flatMap((item) => {
      const rsvp = parseCalendarRsvp(item)
      return rsvp && rsvp.eventCoordinate === coordinate ? [rsvp] : []
    })
  })
}

export function publishNostrCalendarTemplate(
  relays: string[],
  nsec: string,
  template: NostrCalendarEventTemplate
) {
  return withApi(relays, (api) => api.publishTemplate(nsec, template))
}

/** Publishes several templates in order, e.g. an event then its calendars. */
export function publishNostrCalendarTemplates(
  relays: string[],
  nsec: string,
  templates: NostrCalendarEventTemplate[]
) {
  return withApi(relays, async (api) => {
    const published = []
    for (const template of templates) {
      // oxlint-disable-next-line no-await-in-loop -- one relay pool, in order
      published.push(await api.publishTemplate(nsec, template))
    }
    return published
  })
}
