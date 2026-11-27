import { nip19 } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'

import { NOSTR_HEX_PUBKEY_RE } from '@/constants/nostr'
import {
  NOSTR_CALENDAR_FREE_BUSY,
  NOSTR_CALENDAR_MAX_DAY_TAGS,
  NOSTR_CALENDAR_RSVP_STATUSES,
  NOSTR_CALENDAR_TITLE_MAX_LENGTH,
  NOSTR_CALENDAR_WEEK_STARTS_ON
} from '@/constants/nostrCalendar'
import {
  DAYS_PER_WEEK,
  MS_PER_SECOND,
  SECONDS_PER_DAY,
  SECONDS_PER_MINUTE
} from '@/constants/time'
import type {
  NostrCalendar,
  NostrCalendarData,
  NostrCalendarDeletion,
  NostrCalendarDraftError,
  NostrCalendarEvent,
  NostrCalendarEventDraft,
  NostrCalendarFreeBusy,
  NostrCalendarGridDay,
  NostrCalendarParticipant,
  NostrCalendarRawEvent,
  NostrCalendarRsvp,
  NostrCalendarRsvpStatus,
  NostrCalendarRsvpSummary,
  NostrCalendarTemplateResult
} from '@/types/models/NostrCalendar'
import { isSafeHttpUrl } from '@/utils/markdown'

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const UNIX_SECONDS_RE = /^-?\d+$/
const LIST_SPLIT_RE = /[\s,]+/
const LINE_SPLIT_RE = /\r?\n/
const HASHTAG_PREFIX_RE = /^#+/
const MONTHS_PER_YEAR = 12
const GRID_WEEKS = 6
const DATE_KEY_LENGTH = 10
const UTC_TIMEZONE = 'UTC'

const CALENDAR_EVENT_KINDS = new Set<number>([nostrKinds.Date, nostrKinds.Time])

function toUnixSeconds(date: Date): number | null {
  const ms = date.getTime()
  return Number.isFinite(ms) ? ms / MS_PER_SECOND : null
}

function getTag(tags: string[][], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1]
}

function getTags(tags: string[][], name: string): string[] {
  return tags.flatMap((tag) => (tag[0] === name && tag[1] ? [tag[1]] : []))
}

function isCalendarEventCoordinate(value: string): boolean {
  const [kind] = value.split(':')
  return CALENDAR_EVENT_KINDS.has(Number(kind))
}

function isCalendarCoordinate(value: string): boolean {
  return value.startsWith(`${nostrKinds.Calendar}:`)
}

/**
 * Unix seconds for a NIP-52 date-based event (kind 31922) date. The spec uses
 * YYYY-MM-DD, read as UTC midnight; some clients write unix seconds instead.
 */
export function parseCalendarDate(value: string | undefined): number | null {
  if (!value) {
    return null
  }
  if (UNIX_SECONDS_RE.test(value)) {
    const seconds = Number(value)
    const isInDateRange = Number.isFinite(
      new Date(seconds * MS_PER_SECOND).getTime()
    )
    return isInDateRange ? seconds : null
  }
  const match = ISO_DATE_RE.exec(value)
  if (!match) {
    return null
  }
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(0)
  // setUTCFullYear keeps years 0–99 as is; Date.UTC maps them to 19xx.
  date.setUTCFullYear(year, month - 1, day)
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  return isRealDate ? toUnixSeconds(date) : null
}

function parseUnixSeconds(value: string | undefined): number | null {
  if (!value || !UNIX_SECONDS_RE.test(value)) {
    return null
  }
  return parseCalendarDate(value)
}

export function getCalendarCoordinate(
  kind: number,
  pubkey: string,
  dTag: string
): string {
  return `${kind}:${pubkey}:${dTag}`
}

function parseParticipants(tags: string[][]): NostrCalendarParticipant[] {
  return tags.flatMap((tag) => {
    const pubkey = tag[1]?.toLowerCase()
    if (tag[0] !== 'p' || !pubkey || !NOSTR_HEX_PUBKEY_RE.test(pubkey)) {
      return []
    }
    return [
      {
        pubkey,
        ...(tag[2] ? { relay: tag[2] } : {}),
        ...(tag[3] ? { role: tag[3] } : {})
      }
    ]
  })
}

function parseEventTimes(event: NostrCalendarRawEvent) {
  const startTag = getTag(event.tags, 'start')
  const endTag = getTag(event.tags, 'end')
  const isDate = event.kind === nostrKinds.Date
  const start = isDate
    ? parseCalendarDate(startTag)
    : parseUnixSeconds(startTag)
  const end = isDate ? parseCalendarDate(endTag) : parseUnixSeconds(endTag)
  if (start === null) {
    return null
  }
  // NIP-52: start must be less than end; ignore an end that isn't.
  return end !== null && end > start ? { end, start } : { start }
}

/** A raw kind 31922/31923 event as a calendar event; null when invalid. */
export function parseCalendarEvent(
  event: NostrCalendarRawEvent
): NostrCalendarEvent | null {
  if (!CALENDAR_EVENT_KINDS.has(event.kind)) {
    return null
  }
  const dTag = getTag(event.tags, 'd')
  const times = parseEventTimes(event)
  if (dTag === undefined || !times) {
    return null
  }
  const image = getTag(event.tags, 'image')
  const startTzid = getTag(event.tags, 'start_tzid')
  const endTzid = getTag(event.tags, 'end_tzid') ?? startTzid
  const summary = getTag(event.tags, 'summary')
  const geohash = getTag(event.tags, 'g')
  const isTime = event.kind === nostrKinds.Time
  return {
    allDay: !isTime,
    calendarCoordinates: getTags(event.tags, 'a').filter(isCalendarCoordinate),
    coordinate: getCalendarCoordinate(event.kind, event.pubkey, dTag),
    createdAt: event.created_at,
    dTag,
    description: event.content,
    ...times,
    ...(isTime && endTzid ? { endTzid } : {}),
    ...(geohash ? { geohash } : {}),
    hashtags: getTags(event.tags, 't'),
    id: event.id,
    ...(image && isSafeHttpUrl(image) ? { image } : {}),
    kind: event.kind,
    locations: getTags(event.tags, 'location'),
    participants: parseParticipants(event.tags),
    pubkey: event.pubkey,
    references: getTags(event.tags, 'r').filter(isSafeHttpUrl),
    ...(isTime && startTzid ? { startTzid } : {}),
    ...(summary ? { summary } : {}),
    title: getTag(event.tags, 'title') || getTag(event.tags, 'name') || ''
  }
}

/** A raw kind 31924 event as a calendar; null when invalid. */
export function parseCalendar(
  event: NostrCalendarRawEvent
): NostrCalendar | null {
  const dTag = getTag(event.tags, 'd')
  if (event.kind !== nostrKinds.Calendar || dTag === undefined) {
    return null
  }
  return {
    coordinate: getCalendarCoordinate(event.kind, event.pubkey, dTag),
    createdAt: event.created_at,
    dTag,
    description: event.content,
    eventCoordinates: [...new Set(getTags(event.tags, 'a'))].filter(
      isCalendarEventCoordinate
    ),
    id: event.id,
    pubkey: event.pubkey,
    title: getTag(event.tags, 'title') || getTag(event.tags, 'name') || ''
  }
}

function isRsvpStatus(value: unknown): value is NostrCalendarRsvpStatus {
  return NOSTR_CALENDAR_RSVP_STATUSES.some((status) => status === value)
}

function isFreeBusy(value: unknown): value is NostrCalendarFreeBusy {
  return NOSTR_CALENDAR_FREE_BUSY.some((option) => option === value)
}

/** A raw kind 31925 event as an RSVP; null when invalid. */
export function parseCalendarRsvp(
  event: NostrCalendarRawEvent
): NostrCalendarRsvp | null {
  const dTag = getTag(event.tags, 'd')
  const eventCoordinate = getTag(event.tags, 'a')
  const status = getTag(event.tags, 'status')
  if (
    event.kind !== nostrKinds.CalendarEventRSVP ||
    dTag === undefined ||
    !eventCoordinate ||
    !isCalendarEventCoordinate(eventCoordinate) ||
    !isRsvpStatus(status)
  ) {
    return null
  }
  const eventId = getTag(event.tags, 'e')
  const freeBusy = getTag(event.tags, 'fb')
  return {
    coordinate: getCalendarCoordinate(event.kind, event.pubkey, dTag),
    createdAt: event.created_at,
    dTag,
    eventCoordinate,
    ...(eventId ? { eventId } : {}),
    // NIP-52: fb must be ignored when the status is declined.
    ...(status !== 'declined' && isFreeBusy(freeBusy) ? { freeBusy } : {}),
    id: event.id,
    note: event.content,
    pubkey: event.pubkey,
    status
  }
}

/**
 * Addressable events keep only their newest revision per coordinate. Equal
 * timestamps fall back to the lowest id, as NIP-01 says.
 */
export function keepLatestRevisions<
  T extends { coordinate: string; createdAt: number; id: string }
>(items: T[]): T[] {
  const latest = new Map<string, T>()
  for (const item of items) {
    const current = latest.get(item.coordinate)
    const isNewer =
      !current ||
      item.createdAt > current.createdAt ||
      (item.createdAt === current.createdAt && item.id < current.id)
    if (isNewer) {
      latest.set(item.coordinate, item)
    }
  }
  return [...latest.values()]
}

/**
 * NIP-09 deletions, by event id (`e`) and by coordinate (`a`). A coordinate
 * deletion only removes revisions created up to the deletion, and only the
 * author of the deleted event may delete it.
 */
export function getCalendarDeletions(deletions: NostrCalendarDeletion[]) {
  const ids = new Set<string>()
  const coordinates = new Map<string, number>()
  for (const deletion of deletions) {
    const author = deletion.pubkey.toLowerCase()
    for (const [name, value] of deletion.tags) {
      if (name === 'e' && value) {
        ids.add(`${author}:${value}`)
      }
      const coordinateAuthor = value?.split(':')[1]?.toLowerCase()
      if (name === 'a' && value && coordinateAuthor === author) {
        const previous = coordinates.get(value) ?? 0
        coordinates.set(value, Math.max(previous, deletion.created_at))
      }
    }
  }
  return { coordinates, ids }
}

export function isCalendarItemDeleted(
  item: { coordinate: string; createdAt: number; id: string; pubkey: string },
  deletions: ReturnType<typeof getCalendarDeletions>
): boolean {
  if (deletions.ids.has(`${item.pubkey.toLowerCase()}:${item.id}`)) {
    return true
  }
  const deletedAt = deletions.coordinates.get(item.coordinate)
  return deletedAt !== undefined && item.createdAt <= deletedAt
}

export function parseLiveItems<
  T extends Parameters<typeof isCalendarItemDeleted>[0]
>(
  events: NostrCalendarRawEvent[],
  parse: (event: NostrCalendarRawEvent) => T | null,
  deletions: ReturnType<typeof getCalendarDeletions>
): T[] {
  const parsed = events.flatMap((event) => {
    const item = parse(event)
    return item ? [item] : []
  })
  return keepLatestRevisions(parsed).filter(
    (item) => !isCalendarItemDeleted(item, deletions)
  )
}

type CoordinateParts = { dTag: string; kind: number; pubkey: string }

function splitCoordinate(coordinate: string): CoordinateParts | null {
  const [kind, pubkey, ...rest] = coordinate.split(':')
  const lower = pubkey?.toLowerCase() ?? ''
  if (!NOSTR_HEX_PUBKEY_RE.test(lower) || rest.length === 0) {
    return null
  }
  return { dTag: rest.join(':'), kind: Number(kind), pubkey: lower }
}

/**
 * Events by others that one of the own live calendars lists, grouped by
 * author and kind so each group is one relay filter (`authors`, `#d`).
 */
export function getReferencedEventFilters(
  own: NostrCalendarRawEvent[],
  ownPubkey: string,
  deletions: NostrCalendarDeletion[]
): CoordinateParts[][] {
  const calendars = parseLiveItems(
    own.filter((event) => event.pubkey.toLowerCase() === ownPubkey),
    parseCalendar,
    getCalendarDeletions(deletions)
  )
  const groups = new Map<string, CoordinateParts[]>()
  for (const coordinate of new Set(
    calendars.flatMap((calendar) => calendar.eventCoordinates)
  )) {
    const parts = splitCoordinate(coordinate)
    if (parts && parts.pubkey !== ownPubkey) {
      const key = `${parts.kind}:${parts.pubkey}`
      groups.set(key, [...(groups.get(key) ?? []), parts])
    }
  }
  return [...groups.values()]
}

function byStart(a: NostrCalendarEvent, b: NostrCalendarEvent) {
  return a.start - b.start || a.title.localeCompare(b.title)
}

function byTitle(a: { title: string }, b: { title: string }) {
  return a.title.localeCompare(b.title)
}

/** Events by others asking to join one of `calendars`, not yet in it. */
export function getPendingCalendarRequests(
  calendars: NostrCalendar[],
  candidates: NostrCalendarEvent[]
): NostrCalendarEvent[] {
  return candidates.filter((event) =>
    calendars.some(
      (calendar) =>
        event.calendarCoordinates.includes(calendar.coordinate) &&
        !calendar.eventCoordinates.includes(event.coordinate)
    )
  )
}

/** Own calendar data from raw relay events, minus deleted revisions. */
export function buildCalendarData({
  deletions,
  foreign,
  own,
  ownPubkey
}: {
  deletions: NostrCalendarDeletion[]
  /** Events by others: invites (`#p`) and calendar requests (`#a`). */
  foreign: NostrCalendarRawEvent[]
  own: NostrCalendarRawEvent[]
  ownPubkey: string
}): NostrCalendarData {
  const deleted = getCalendarDeletions(deletions)
  const mine = own.filter((event) => event.pubkey.toLowerCase() === ownPubkey)
  const others = foreign.filter(
    (event) => event.pubkey.toLowerCase() !== ownPubkey
  )
  const calendars = parseLiveItems(mine, parseCalendar, deleted).toSorted(
    byTitle
  )
  const otherEvents = parseLiveItems(others, parseCalendarEvent, deleted)
  return {
    calendars,
    events: parseLiveItems(mine, parseCalendarEvent, deleted).toSorted(byStart),
    foreignEvents: otherEvents.toSorted(byStart),
    invites: otherEvents
      .filter((event) =>
        event.participants.some(({ pubkey }) => pubkey === ownPubkey)
      )
      .toSorted(byStart),
    requests: getPendingCalendarRequests(calendars, otherEvents).toSorted(
      byStart
    ),
    rsvps: parseLiveItems(mine, parseCalendarRsvp, deleted)
  }
}

/** `data` with a freshly published own event in place of older revisions. */
export function applyPublishedCalendarEvent(
  data: NostrCalendarData,
  published: NostrCalendarRawEvent
): NostrCalendarData {
  const event = parseCalendarEvent(published)
  if (event) {
    const events = keepLatestRevisions([...data.events, event])
    return { ...data, events: events.toSorted(byStart) }
  }
  const calendar = parseCalendar(published)
  if (calendar) {
    const calendars = keepLatestRevisions([...data.calendars, calendar])
    const ordered = calendars.toSorted(byTitle)
    return {
      ...data,
      calendars: ordered,
      requests: getPendingCalendarRequests(ordered, data.requests)
    }
  }
  const rsvp = parseCalendarRsvp(published)
  if (rsvp) {
    return { ...data, rsvps: keepLatestRevisions([...data.rsvps, rsvp]) }
  }
  return data
}

/** `data` with every freshly published event applied in order. */
export function applyPublishedCalendarEvents(
  data: NostrCalendarData,
  published: NostrCalendarRawEvent[]
): NostrCalendarData {
  if (published.length === 0) {
    return data
  }
  const [first, ...rest] = published
  return applyPublishedCalendarEvents(
    applyPublishedCalendarEvent(data, first),
    rest
  )
}

/** `data` without the item at `coordinate`, after deleting it. */
export function removeCalendarItem(
  data: NostrCalendarData,
  coordinate: string
): NostrCalendarData {
  function keep(item: { coordinate: string }) {
    return item.coordinate !== coordinate
  }
  return {
    ...data,
    calendars: data.calendars.filter(keep),
    events: data.events.filter(keep),
    rsvps: data.rsvps.filter(keep)
  }
}

/**
 * Every known calendar event, own first, by coordinate. Switching all-day
 * moves an event to the other kind under the same `d` tag, so a coordinate
 * of the old kind still finds it.
 */
export function findCalendarEvent(
  data: NostrCalendarData,
  coordinate: string
): NostrCalendarEvent | undefined {
  const known = [...data.events, ...data.foreignEvents]
  const exact = known.find((event) => event.coordinate === coordinate)
  if (exact) {
    return exact
  }
  const parts = splitCoordinate(coordinate)
  if (!parts || !CALENDAR_EVENT_KINDS.has(parts.kind)) {
    return undefined
  }
  return known.find(
    (event) => event.pubkey === parts.pubkey && event.dTag === parts.dTag
  )
}

/**
 * Own events plus invites, optionally only those of one calendar. A selected
 * calendar also shows events by others it lists, such as accepted requests.
 */
export function getVisibleCalendarEvents(
  data: NostrCalendarData,
  calendarCoordinate?: string
): NostrCalendarEvent[] {
  if (!calendarCoordinate) {
    return keepLatestRevisions([...data.events, ...data.invites]).toSorted(
      byStart
    )
  }
  const calendar = data.calendars.find(
    (item) => item.coordinate === calendarCoordinate
  )
  const listed = data.foreignEvents.filter((event) =>
    calendar?.eventCoordinates.includes(event.coordinate)
  )
  return keepLatestRevisions([...data.events, ...data.invites, ...listed])
    .filter(
      (event) =>
        calendar?.eventCoordinates.includes(event.coordinate) ||
        (event.pubkey === calendar?.pubkey &&
          event.calendarCoordinates.includes(calendarCoordinate))
    )
    .toSorted(byStart)
}

/** RSVPs from many authors: each author's newest answer counts once. */
export function summarizeRsvps(
  rsvps: NostrCalendarRsvp[]
): NostrCalendarRsvpSummary {
  const latestByAuthor = new Map<string, NostrCalendarRsvp>()
  for (const rsvp of rsvps) {
    const current = latestByAuthor.get(rsvp.pubkey)
    if (!current || rsvp.createdAt > current.createdAt) {
      latestByAuthor.set(rsvp.pubkey, rsvp)
    }
  }
  const summary: NostrCalendarRsvpSummary = {
    accepted: 0,
    declined: 0,
    tentative: 0
  }
  for (const { status } of latestByAuthor.values()) {
    summary[status] += 1
  }
  return summary
}

export function findOwnRsvp(
  rsvps: NostrCalendarRsvp[],
  eventCoordinate: string,
  ownPubkey: string
): NostrCalendarRsvp | undefined {
  return rsvps
    .filter(
      (rsvp) =>
        rsvp.eventCoordinate === eventCoordinate && rsvp.pubkey === ownPubkey
    )
    .toSorted((a, b) => b.createdAt - a.createdAt)[0]
}

// ─── Dates and time zones ───────────────────────────────────────────────────

export function getDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || UTC_TIMEZONE
}

export function isValidTimezone(timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone
    })
    return Boolean(formatter.resolvedOptions().timeZone)
  } catch {
    return false
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** YYYY-MM-DD of a unix time as seen in `timezone`. */
export function getDateKey(unixSeconds: number, timezone = UTC_TIMEZONE) {
  const parts = getZonedParts(unixSeconds * MS_PER_SECOND, timezone)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

function getZonedParts(ms: number, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
    minute: 'numeric',
    month: 'numeric',
    second: 'numeric',
    timeZone: timezone,
    year: 'numeric'
  })
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(ms))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  )
  return {
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    month: values.month ?? 1,
    second: values.second ?? 0,
    year: values.year ?? 1970
  }
}

function getTimezoneOffsetMs(ms: number, timezone: string): number {
  const parts = getZonedParts(ms, timezone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
  return asUtc - Math.floor(ms / MS_PER_SECOND) * MS_PER_SECOND
}

/** Unix seconds of a wall-clock date and time in `timezone`. */
export function zonedTimeToUnix(
  dateKey: string,
  time: string,
  timezone: string
): number | null {
  const dayStart = parseCalendarDate(dateKey)
  const timeMatch = TIME_RE.exec(time)
  if (dayStart === null || !ISO_DATE_RE.test(dateKey) || !timeMatch) {
    return null
  }
  const [hours, minutes] = timeMatch.slice(1).map(Number)
  const wallClockMs =
    (dayStart + (hours * SECONDS_PER_MINUTE + minutes) * SECONDS_PER_MINUTE) *
    MS_PER_SECOND
  // The offset at the wall-clock instant can differ from the real one across
  // a DST change, so correct with the offset at the first guess.
  const guess = wallClockMs - getTimezoneOffsetMs(wallClockMs, timezone)
  const corrected = wallClockMs - getTimezoneOffsetMs(guess, timezone)
  const seconds = Math.floor(corrected / MS_PER_SECOND)
  // A wall time skipped by a DST change (02:30 on a spring-forward night)
  // has no instant; the correction would land an hour off.
  const exists =
    getDateKey(seconds, timezone) === dateKey &&
    getTimeKey(seconds, timezone) === time
  return exists ? seconds : null
}

/** HH:MM of a unix time as seen in `timezone`. */
export function getTimeKey(unixSeconds: number, timezone: string): string {
  const parts = getZonedParts(unixSeconds * MS_PER_SECOND, timezone)
  return `${pad(parts.hour)}:${pad(parts.minute)}`
}

function addDaysToKey(dateKey: string, days: number): string {
  const seconds = parseCalendarDate(dateKey) ?? 0
  return getDateKey(seconds + days * SECONDS_PER_DAY)
}

/** Day keys (YYYY-MM-DD) an event covers, in the viewer's time zone. */
export function getEventDayKeys(
  event: Pick<NostrCalendarEvent, 'allDay' | 'end' | 'start'>,
  timezone: string
): string[] {
  const displayZone = event.allDay ? UTC_TIMEZONE : timezone
  const first = getDateKey(event.start, displayZone)
  // End is exclusive: an event ending at midnight doesn't cover that day.
  const lastInstant =
    event.end === undefined ? event.start : Math.max(event.start, event.end - 1)
  const last = getDateKey(lastInstant, displayZone)
  const firstSeconds = parseCalendarDate(first) ?? 0
  const lastSeconds = parseCalendarDate(last) ?? firstSeconds
  const dayCount = Math.min(
    Math.max(0, Math.round((lastSeconds - firstSeconds) / SECONDS_PER_DAY)) + 1,
    NOSTR_CALENDAR_MAX_DAY_TAGS
  )
  return Array.from({ length: dayCount }, (_, index) =>
    addDaysToKey(first, index)
  )
}

/** Events grouped by the day keys they cover. */
export function groupEventsByDay(
  events: NostrCalendarEvent[],
  timezone: string
): Map<string, NostrCalendarEvent[]> {
  const byDay = new Map<string, NostrCalendarEvent[]>()
  for (const event of events) {
    for (const key of getEventDayKeys(event, timezone)) {
      byDay.set(key, [...(byDay.get(key) ?? []), event])
    }
  }
  return byDay
}

export type NostrCalendarMonth = { month: number; year: number }

export function getMonthOfDateKey(dateKey: string): NostrCalendarMonth {
  const [year, month] = dateKey.split('-').map(Number)
  return { month, year }
}

export function shiftMonth(
  { month, year }: NostrCalendarMonth,
  delta: number
): NostrCalendarMonth {
  const index = year * MONTHS_PER_YEAR + (month - 1) + delta
  return {
    month: (index % MONTHS_PER_YEAR) + 1,
    year: Math.floor(index / MONTHS_PER_YEAR)
  }
}

/** Six weeks of days around `month`, starting on the configured weekday. */
export function buildMonthGrid({
  month,
  year
}: NostrCalendarMonth): NostrCalendarGridDay[] {
  const firstKey = `${String(year).padStart(4, '0')}-${pad(month)}-01`
  const firstSeconds = parseCalendarDate(firstKey) ?? 0
  const weekday = new Date(firstSeconds * MS_PER_SECOND).getUTCDay()
  const leading =
    (weekday - NOSTR_CALENDAR_WEEK_STARTS_ON + DAYS_PER_WEEK) % DAYS_PER_WEEK
  const gridStart = firstSeconds - leading * SECONDS_PER_DAY
  return Array.from({ length: GRID_WEEKS * DAYS_PER_WEEK }, (_, index) => {
    const dateKey = getDateKey(gridStart + index * SECONDS_PER_DAY)
    return {
      dateKey,
      day: Number(dateKey.slice(-2)),
      inMonth: dateKey.startsWith(firstKey.slice(0, -3))
    }
  })
}

// ─── Building events ────────────────────────────────────────────────────────

function splitList(value: string, separator: RegExp): string[] {
  return [
    ...new Set(
      value
        .split(separator)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ]
}

function parsePubkey(value: string): string | null {
  const lower = value.toLowerCase()
  if (NOSTR_HEX_PUBKEY_RE.test(lower)) {
    return lower
  }
  try {
    const decoded = nip19.decode(value)
    if (decoded.type === 'npub') {
      return decoded.data
    }
    if (decoded.type === 'nprofile') {
      return decoded.data.pubkey
    }
    return null
  } catch {
    return null
  }
}

type DraftTimes =
  | { ok: true; tags: string[][] }
  | { error: NostrCalendarDraftError; ok: false }

function draftError(error: NostrCalendarDraftError): DraftTimes {
  return { error, ok: false }
}

function buildDateTags(draft: NostrCalendarEventDraft): DraftTimes {
  const start = parseCalendarDate(draft.startDate)
  if (start === null || !ISO_DATE_RE.test(draft.startDate)) {
    return draftError('invalidStartDate')
  }
  if (!draft.endDate) {
    return { ok: true, tags: [['start', draft.startDate]] }
  }
  const lastDay = parseCalendarDate(draft.endDate)
  if (lastDay === null || !ISO_DATE_RE.test(draft.endDate)) {
    return draftError('invalidEndDate')
  }
  if (lastDay < start) {
    return draftError('endBeforeStart')
  }
  // The form asks for the last day; NIP-52's end date is exclusive.
  const exclusiveEnd = addDaysToKey(draft.endDate, 1)
  return {
    ok: true,
    tags: [
      ['start', draft.startDate],
      ['end', exclusiveEnd]
    ]
  }
}

/**
 * An edited event's instant while its date, time and zone are unchanged. An
 * ambiguous wall time (01:30 on a fall-back night) would otherwise resolve
 * to its first occurrence and move the event.
 */
function keepOriginalInstant(
  original: number | undefined,
  wall: { date: string; time: string; timezone: string },
  convert: () => number | null
): number | null {
  const unchanged =
    original !== undefined &&
    getDateKey(original, wall.timezone) === wall.date &&
    getTimeKey(original, wall.timezone) === wall.time
  return unchanged ? original : convert()
}

function buildTimeTags(draft: NostrCalendarEventDraft): DraftTimes {
  const timezone = isValidTimezone(draft.timezone)
    ? draft.timezone
    : UTC_TIMEZONE
  if (!ISO_DATE_RE.test(draft.startDate)) {
    return draftError('invalidStartDate')
  }
  const start = keepOriginalInstant(
    draft.original?.start,
    { date: draft.startDate, time: draft.startTime, timezone },
    () => zonedTimeToUnix(draft.startDate, draft.startTime, timezone)
  )
  if (start === null) {
    return draftError('invalidStartTime')
  }
  const hasEnd = Boolean(draft.endTime)
  const endDate = draft.endDate || draft.startDate
  if (hasEnd && !ISO_DATE_RE.test(endDate)) {
    return draftError('invalidEndDate')
  }
  const end = hasEnd
    ? keepOriginalInstant(
        draft.original?.end,
        { date: endDate, time: draft.endTime, timezone },
        () => zonedTimeToUnix(endDate, draft.endTime, timezone)
      )
    : null
  if (hasEnd && end === null) {
    return draftError('invalidEndTime')
  }
  if (end !== null && end <= start) {
    return draftError('endBeforeStart')
  }
  const range = end === null ? { start } : { end, start }
  const dayTags = getEventDayKeys({ allDay: false, ...range }, UTC_TIMEZONE)
    .map((key) => parseCalendarDate(key) ?? 0)
    .map((seconds) => ['D', String(Math.floor(seconds / SECONDS_PER_DAY))])
  return {
    ok: true,
    tags: [
      ['start', String(start)],
      ...(end === null ? [] : [['end', String(end)]]),
      ['start_tzid', timezone],
      ['end_tzid', timezone],
      ...dayTags
    ]
  }
}

function buildParticipantTags(value: string): string[][] | null {
  const pubkeys = splitList(value, LIST_SPLIT_RE).map(parsePubkey)
  if (pubkeys.some((pubkey) => pubkey === null)) {
    return null
  }
  return [...new Set(pubkeys)].map((pubkey) => ['p', pubkey ?? ''])
}

/**
 * A signed-ready kind 31922/31923 template from the form, with the NIP-52
 * required tags (`d`, `title`, `start`, and `D` for time-based events).
 */
export function buildCalendarEventTemplate(
  draft: NostrCalendarEventDraft
): NostrCalendarTemplateResult {
  const title = draft.title.trim().slice(0, NOSTR_CALENDAR_TITLE_MAX_LENGTH)
  if (!title) {
    return { error: 'titleRequired', ok: false }
  }
  const times = draft.allDay ? buildDateTags(draft) : buildTimeTags(draft)
  if (!times.ok) {
    return { error: times.error, ok: false }
  }
  const participants = buildParticipantTags(draft.participants)
  if (!participants) {
    return { error: 'invalidParticipant', ok: false }
  }
  const image = draft.image.trim()
  if (image && !isSafeHttpUrl(image)) {
    return { error: 'invalidImage', ok: false }
  }
  const references = splitList(draft.references, LINE_SPLIT_RE)
  if (!references.every(isSafeHttpUrl)) {
    return { error: 'invalidLink', ok: false }
  }
  const summary = draft.summary.trim()
  const tags = [
    ['d', draft.dTag],
    ['title', title],
    ...times.tags,
    ...(summary ? [['summary', summary]] : []),
    ...(image ? [['image', image]] : []),
    ...splitList(draft.locations, LINE_SPLIT_RE).map((loc) => [
      'location',
      loc
    ]),
    ...participants,
    ...splitList(draft.hashtags, LIST_SPLIT_RE)
      .map((tag) => tag.replace(HASHTAG_PREFIX_RE, '').toLowerCase())
      .filter(Boolean)
      .map((tag) => ['t', tag]),
    ...references.map((url) => ['r', url]),
    ...draft.calendarCoordinates.map((coordinate) => ['a', coordinate])
  ]
  return {
    ok: true,
    template: {
      content: draft.description.trim(),
      kind: draft.allDay ? nostrKinds.Date : nostrKinds.Time,
      tags
    }
  }
}

/** A form draft prefilled from an existing event, for editing. */
export function draftFromCalendarEvent(
  event: NostrCalendarEvent,
  timezone: string
): NostrCalendarEventDraft {
  // An unknown stored zone would make Intl throw; fall back to the device's.
  const zone =
    event.startTzid && isValidTimezone(event.startTzid)
      ? event.startTzid
      : timezone
  const displayZone = event.allDay ? UTC_TIMEZONE : zone
  const lastDay =
    event.end === undefined
      ? ''
      : getDateKey(
          event.allDay ? event.end - SECONDS_PER_DAY : event.end,
          displayZone
        )
  const startDate = getDateKey(event.start, displayZone)
  return {
    allDay: event.allDay,
    calendarCoordinates: event.calendarCoordinates,
    dTag: event.dTag,
    description: event.description,
    endDate: lastDay === startDate ? '' : lastDay,
    endTime:
      event.allDay || event.end === undefined
        ? ''
        : getTimeKey(event.end, zone),
    hashtags: event.hashtags.join(', '),
    image: event.image ?? '',
    locations: event.locations.join('\n'),
    ...(event.allDay
      ? {}
      : {
          original: {
            ...(event.end === undefined ? {} : { end: event.end }),
            start: event.start
          }
        }),
    participants: event.participants
      .map(({ pubkey }) => nip19.npubEncode(pubkey))
      .join('\n'),
    references: event.references.join('\n'),
    startDate,
    startTime: event.allDay ? '' : getTimeKey(event.start, zone),
    summary: event.summary ?? '',
    timezone: zone,
    title: event.title
  }
}

export function emptyCalendarEventDraft({
  dTag,
  startDate,
  timezone
}: {
  dTag: string
  startDate: string
  timezone: string
}): NostrCalendarEventDraft {
  return {
    allDay: true,
    calendarCoordinates: [],
    dTag,
    description: '',
    endDate: '',
    endTime: '',
    hashtags: '',
    image: '',
    locations: '',
    participants: '',
    references: '',
    startDate: startDate.slice(0, DATE_KEY_LENGTH),
    startTime: '',
    summary: '',
    timezone,
    title: ''
  }
}

/** Kind 31924 template; `eventCoordinates` keeps the calendar's events. */
export function buildCalendarTemplate({
  description,
  dTag,
  eventCoordinates,
  title
}: {
  description: string
  dTag: string
  eventCoordinates: string[]
  title: string
}): NostrCalendarTemplateResult {
  const trimmed = title.trim().slice(0, NOSTR_CALENDAR_TITLE_MAX_LENGTH)
  if (!trimmed) {
    return { error: 'titleRequired', ok: false }
  }
  return {
    ok: true,
    template: {
      content: description.trim(),
      kind: nostrKinds.Calendar,
      tags: [
        ['d', dTag],
        ['title', trimmed],
        ...[...new Set(eventCoordinates)].map((coordinate) => ['a', coordinate])
      ]
    }
  }
}

/**
 * Kind 31925 template. The `d` tag is derived from the event coordinate so a
 * new answer replaces the previous one instead of adding another RSVP.
 */
export function buildRsvpTemplate({
  event,
  freeBusy,
  note,
  status
}: {
  event: Pick<NostrCalendarEvent, 'coordinate' | 'id' | 'pubkey'>
  freeBusy?: NostrCalendarFreeBusy
  note: string
  status: NostrCalendarRsvpStatus
}) {
  return {
    content: note.trim(),
    kind: nostrKinds.CalendarEventRSVP,
    tags: [
      ['d', event.coordinate],
      ['a', event.coordinate],
      ['e', event.id],
      ['p', event.pubkey],
      ['status', status],
      ...(status !== 'declined' && freeBusy ? [['fb', freeBusy]] : [])
    ]
  }
}

/** NIP-09 deletion of an addressable event: every revision, by `a` and `e`. */
export function buildCalendarDeletionTemplate(
  item: Pick<NostrCalendarEvent, 'coordinate' | 'id'> & { kind: number }
) {
  return {
    content: '',
    kind: nostrKinds.EventDeletion,
    tags: [
      ['a', item.coordinate],
      ['e', item.id],
      ['k', String(item.kind)]
    ]
  }
}

/** Calendar template with `eventCoordinate` added or removed. */
export function toggleCalendarEvent(
  calendar: NostrCalendar,
  eventCoordinate: string,
  include: boolean
): NostrCalendarTemplateResult {
  const rest = calendar.eventCoordinates.filter(
    (coordinate) => coordinate !== eventCoordinate
  )
  return buildCalendarTemplate({
    dTag: calendar.dTag,
    description: calendar.description,
    eventCoordinates: include ? [...rest, eventCoordinate] : rest,
    title: calendar.title
  })
}

/** `naddr` of an addressable calendar item, for sharing. */
export function encodeCalendarAddress(
  item: Pick<NostrCalendarEvent, 'dTag' | 'pubkey'> & { kind: number },
  relays: string[]
): string {
  return nip19.naddrEncode({
    identifier: item.dTag,
    kind: item.kind,
    pubkey: item.pubkey,
    relays: relays.slice(0, 2)
  })
}

// ─── Display ────────────────────────────────────────────────────────────────

function formatDay(unixSeconds: number, timezone: string) {
  return new Date(unixSeconds * MS_PER_SECOND).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric'
  })
}

function formatTime(unixSeconds: number, timezone: string) {
  return new Date(unixSeconds * MS_PER_SECOND).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone
  })
}

/**
 * When an event happens, in the viewer's time zone for time-based events.
 * Date-based events are the same days everywhere, so they stay in UTC.
 */
export function formatCalendarEventWhen(
  event: Pick<NostrCalendarEvent, 'allDay' | 'end' | 'start'>,
  timezone: string
): { end?: string; start: string } {
  if (event.allDay) {
    const lastDay =
      event.end === undefined ? undefined : event.end - SECONDS_PER_DAY
    const multiDay = lastDay !== undefined && lastDay > event.start
    return {
      ...(multiDay ? { end: formatDay(lastDay, UTC_TIMEZONE) } : {}),
      start: formatDay(event.start, UTC_TIMEZONE)
    }
  }
  const start = `${formatDay(event.start, timezone)} ${formatTime(event.start, timezone)}`
  if (event.end === undefined) {
    return { start }
  }
  const sameDay =
    getDateKey(event.start, timezone) === getDateKey(event.end, timezone)
  const end = sameDay
    ? formatTime(event.end, timezone)
    : `${formatDay(event.end, timezone)} ${formatTime(event.end, timezone)}`
  return { end, start }
}

/** Short time label for an agenda row; empty for all-day events. */
export function formatCalendarEventTime(
  event: Pick<NostrCalendarEvent, 'allDay' | 'end' | 'start'>,
  timezone: string
): string {
  if (event.allDay) {
    return ''
  }
  const start = formatTime(event.start, timezone)
  return event.end === undefined
    ? start
    : `${start} – ${formatTime(event.end, timezone)}`
}

export function formatMonthTitle({ month, year }: NostrCalendarMonth): string {
  const firstOfMonth = parseCalendarDate(
    `${String(year).padStart(4, '0')}-${pad(month)}-01`
  )
  return new Date((firstOfMonth ?? 0) * MS_PER_SECOND).toLocaleDateString(
    undefined,
    { month: 'long', timeZone: UTC_TIMEZONE, year: 'numeric' }
  )
}

export function formatDayTitle(dateKey: string): string {
  return formatDay(parseCalendarDate(dateKey) ?? 0, UTC_TIMEZONE)
}

/** Whether an event is over, so agendas can split upcoming from past. */
export function isCalendarEventPast(
  event: Pick<NostrCalendarEvent, 'allDay' | 'end' | 'start'>,
  nowSeconds: number
): boolean {
  const end =
    event.end ?? (event.allDay ? event.start + SECONDS_PER_DAY : event.start)
  return end <= nowSeconds
}

// ─── Pickers ────────────────────────────────────────────────────────────────

const HOURS_PER_DAY_COUNT = 24
const MINUTES_PER_HOUR_COUNT = 60

export const CALENDAR_HOUR_OPTIONS = Array.from(
  { length: HOURS_PER_DAY_COUNT },
  (_, hour) => pad(hour)
)
export const CALENDAR_MINUTE_OPTIONS = Array.from(
  { length: MINUTES_PER_HOUR_COUNT },
  (_, minute) => pad(minute)
)

/** Hour and minute of an HH:MM value; null when it isn't one. */
export function parseTimeKey(
  time: string
): { hours: number; minutes: number } | null {
  const match = TIME_RE.exec(time)
  if (!match) {
    return null
  }
  const [hours, minutes] = match.slice(1).map(Number)
  return { hours, minutes }
}

export function formatTimeKey(hours: number, minutes: number): string {
  return `${pad(hours)}:${pad(minutes)}`
}

/** Label for a picked YYYY-MM-DD, or undefined when nothing valid is set. */
export function formatDateKeyLabel(dateKey: string): string | undefined {
  return ISO_DATE_RE.test(dateKey) && parseCalendarDate(dateKey) !== null
    ? formatDayTitle(dateKey)
    : undefined
}

/** The month to open a date picker on: the value's, else the fallback's. */
export function getPickerMonth(
  dateKey: string,
  fallbackKey: string
): NostrCalendarMonth {
  return getMonthOfDateKey(formatDateKeyLabel(dateKey) ? dateKey : fallbackKey)
}
