import * as nostrKinds from 'nostr-tools/kinds'

import type {
  NostrCalendarFreeBusy,
  NostrCalendarRsvpStatus
} from '@/types/models/NostrCalendar'

import { MS_PER_SECOND, SECONDS_PER_MINUTE } from './time'

export const NOSTR_CALENDAR_EVENT_KINDS = [nostrKinds.Date, nostrKinds.Time]

/** Own events and calendars; own RSVPs are fetched on their own. */
export const NOSTR_CALENDAR_OWN_KINDS = [
  ...NOSTR_CALENDAR_EVENT_KINDS,
  nostrKinds.Calendar
]

export const NOSTR_CALENDAR_FETCH_LIMIT = 500
export const NOSTR_CALENDAR_RSVPS_FETCH_LIMIT = 500
export const NOSTR_CALENDAR_INVITES_FETCH_LIMIT = 200
export const NOSTR_CALENDAR_DELETIONS_FETCH_LIMIT = 200
/** Keeps `#a` and `authors` filters within what relays accept. */
export const NOSTR_CALENDAR_MAX_FILTER_VALUES = 200
/** Events by others listed in own calendars: one request per author and kind. */
export const NOSTR_CALENDAR_REFERENCED_FILTERS_MAX = 20
export const NOSTR_CALENDAR_STALE_TIME_MS =
  5 * SECONDS_PER_MINUTE * MS_PER_SECOND

/** NIP-52 asks for one `D` tag per day; a year is plenty for one event. */
export const NOSTR_CALENDAR_MAX_DAY_TAGS = 366

export const NOSTR_CALENDAR_RSVP_STATUSES: NostrCalendarRsvpStatus[] = [
  'accepted',
  'tentative',
  'declined'
]

export const NOSTR_CALENDAR_FREE_BUSY: NostrCalendarFreeBusy[] = [
  'busy',
  'free'
]

export const NOSTR_CALENDAR_DEFAULT_START_TIME = '09:00'
export const NOSTR_CALENDAR_DEFAULT_END_TIME = '10:00'
export const NOSTR_CALENDAR_TITLE_MAX_LENGTH = 200
export const NOSTR_CALENDAR_WEEK_STARTS_ON = 0
