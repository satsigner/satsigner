import type { NostrEvent } from 'nostr-tools'

export type NostrCalendarRawEvent = Pick<
  NostrEvent,
  'content' | 'created_at' | 'id' | 'kind' | 'pubkey' | 'tags'
>

export type NostrCalendarDeletion = Pick<
  NostrEvent,
  'created_at' | 'pubkey' | 'tags'
>

export type NostrCalendarEventTemplate = Pick<
  NostrEvent,
  'content' | 'kind' | 'tags'
>

export type NostrCalendarRsvpStatus = 'accepted' | 'declined' | 'tentative'

export type NostrCalendarFreeBusy = 'busy' | 'free'

export type NostrCalendarParticipant = {
  pubkey: string
  relay?: string
  role?: string
}

type NostrCalendarAddressable = {
  coordinate: string
  createdAt: number
  dTag: string
  id: string
  pubkey: string
}

/** A NIP-52 calendar event, date-based (31922) or time-based (31923). */
export type NostrCalendarEvent = NostrCalendarAddressable & {
  allDay: boolean
  calendarCoordinates: string[]
  description: string
  /** Unix seconds, exclusive. Date-based events use UTC midnight. */
  end?: number
  endTzid?: string
  geohash?: string
  hashtags: string[]
  image?: string
  kind: number
  locations: string[]
  participants: NostrCalendarParticipant[]
  references: string[]
  /** Unix seconds, inclusive. Date-based events use UTC midnight. */
  start: number
  startTzid?: string
  summary?: string
  title: string
}

/** A NIP-52 calendar (31924): a list of calendar event coordinates. */
export type NostrCalendar = NostrCalendarAddressable & {
  description: string
  eventCoordinates: string[]
  title: string
}

/** A NIP-52 RSVP (31925) to a calendar event. */
export type NostrCalendarRsvp = NostrCalendarAddressable & {
  eventCoordinate: string
  eventId?: string
  freeBusy?: NostrCalendarFreeBusy
  note: string
  status: NostrCalendarRsvpStatus
}

export type NostrCalendarData = {
  calendars: NostrCalendar[]
  /** Own calendar events, sorted by start. */
  events: NostrCalendarEvent[]
  /** Every event by others that was fetched, sorted by start. */
  foreignEvents: NostrCalendarEvent[]
  /** Events by others that tag this identity, sorted by start. */
  invites: NostrCalendarEvent[]
  /** Events by others asking to join an own calendar, sorted by start. */
  requests: NostrCalendarEvent[]
  rsvps: NostrCalendarRsvp[]
}

export type NostrCalendarRsvpSummary = Record<NostrCalendarRsvpStatus, number>

/** Form state for creating or editing a calendar event. */
export type NostrCalendarEventDraft = {
  allDay: boolean
  calendarCoordinates: string[]
  description: string
  dTag: string
  /** Inclusive last day, YYYY-MM-DD. Empty for a single day. */
  endDate: string
  /** HH:MM, time-based events only. */
  endTime: string
  /** Comma separated. */
  hashtags: string
  image: string
  /** One per line. */
  locations: string
  /** npubs or hex pubkeys, separated by spaces, commas or lines. */
  participants: string
  /** One link per line. */
  references: string
  startDate: string
  startTime: string
  summary: string
  /** IANA time zone the times were entered in. */
  timezone: string
  title: string
}

export type NostrCalendarDraftError =
  | 'endBeforeStart'
  | 'invalidEndDate'
  | 'invalidEndTime'
  | 'invalidImage'
  | 'invalidLink'
  | 'invalidParticipant'
  | 'invalidStartDate'
  | 'invalidStartTime'
  | 'titleRequired'

export type NostrCalendarTemplateResult =
  | { ok: true; template: NostrCalendarEventTemplate }
  | { error: NostrCalendarDraftError; ok: false }

export type NostrCalendarGridDay = {
  dateKey: string
  day: number
  inMonth: boolean
}
