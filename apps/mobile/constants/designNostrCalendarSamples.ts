import * as nostrKinds from 'nostr-tools/kinds'

import {
  MS_PER_SECOND,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR
} from '@/constants/time'
import type {
  NostrCalendarData,
  NostrCalendarEvent,
  NostrCalendarRsvpSummary
} from '@/types/models/NostrCalendar'
import { getCalendarCoordinate } from '@/utils/nostrCalendar'

import type { DesignSampleSet } from './designSampleVariations'

const NOW = Math.floor(Date.now() / MS_PER_SECOND)
const TODAY_START = Math.floor(NOW / SECONDS_PER_DAY) * SECONDS_PER_DAY

const ME_HEX =
  '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e'
const ALICE_HEX =
  'a1f3c5d7e9b2a4c6e8f0a1b3c5d7e9f1a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2'
const BOB_HEX =
  'b0b5ca11ab1e0ddba11c0ffee15600dfacade5eed5beefcafe0123456789abcd'

const MEETUPS_COORDINATE = getCalendarCoordinate(
  nostrKinds.Calendar,
  ME_HEX,
  'meetups'
)
const TRAVEL_COORDINATE = getCalendarCoordinate(
  nostrKinds.Calendar,
  ME_HEX,
  'travel'
)

function timeEvent(
  dTag: string,
  title: string,
  startOffset: number,
  durationHours: number,
  extra: Partial<NostrCalendarEvent> = {}
): NostrCalendarEvent {
  const pubkey = extra.pubkey ?? ME_HEX
  const start = TODAY_START + startOffset
  return {
    allDay: false,
    calendarCoordinates: [],
    coordinate: getCalendarCoordinate(nostrKinds.Time, pubkey, dTag),
    createdAt: NOW,
    dTag,
    description: '',
    end: start + durationHours * SECONDS_PER_HOUR,
    endTzid: 'Europe/Lisbon',
    hashtags: [],
    id: dTag.padEnd(64, '0'),
    kind: nostrKinds.Time,
    locations: [],
    participants: [],
    pubkey,
    references: [],
    start,
    startTzid: 'Europe/Lisbon',
    title,
    ...extra
  }
}

function dateEvent(
  dTag: string,
  title: string,
  startDays: number,
  lengthDays: number,
  extra: Partial<NostrCalendarEvent> = {}
): NostrCalendarEvent {
  const start = TODAY_START + startDays * SECONDS_PER_DAY
  return {
    allDay: true,
    calendarCoordinates: [],
    coordinate: getCalendarCoordinate(nostrKinds.Date, ME_HEX, dTag),
    createdAt: NOW,
    dTag,
    description: '',
    end: start + lengthDays * SECONDS_PER_DAY,
    hashtags: [],
    id: dTag.padEnd(64, '1'),
    kind: nostrKinds.Date,
    locations: [],
    participants: [],
    pubkey: ME_HEX,
    references: [],
    start,
    title,
    ...extra
  }
}

const MEETUP = timeEvent('meetup', 'Bitcoin meetup', 19 * SECONDS_PER_HOUR, 2, {
  calendarCoordinates: [MEETUPS_COORDINATE],
  description:
    'Monthly meetup. Bring a hardware wallet if you want help setting up a multisig vault.',
  hashtags: ['bitcoin', 'meetup'],
  locations: ['Lisbon, Praça do Comércio 12'],
  participants: [
    { pubkey: ALICE_HEX, role: 'host' },
    { pubkey: BOB_HEX, role: 'speaker' }
  ],
  references: ['https://satsigner.com'],
  summary: 'Multisig workshop and drinks'
})

const CALL = timeEvent(
  'call',
  'Cosigner key ceremony',
  2 * SECONDS_PER_DAY + 10 * SECONDS_PER_HOUR,
  1,
  {
    participants: [{ pubkey: ME_HEX }],
    pubkey: ALICE_HEX
  }
)

const CONFERENCE = dateEvent('conference', 'Conference trip', 5, 3, {
  calendarCoordinates: [TRAVEL_COORDINATE],
  locations: ['Riga']
})

const PAST = timeEvent(
  'review',
  'PSBT review',
  -3 * SECONDS_PER_DAY + 15 * SECONDS_PER_HOUR,
  1
)

const HOLIDAY = dateEvent('holiday', 'Bitcoin pizza day', 0, 1)

function longTitle(index: number): string {
  return `Signing session ${index + 1} with a very long title that wraps over two lines`
}

const HEAVY_EVENTS = Array.from({ length: 12 }, (_, index) =>
  timeEvent(
    `heavy-${index}`,
    longTitle(index),
    (index % 4) * SECONDS_PER_DAY + (8 + index) * SECONDS_PER_HOUR,
    1,
    {
      locations: [
        `Room ${index + 1}, long address street name that keeps going`
      ]
    }
  )
)

const CALENDARS = [
  {
    coordinate: MEETUPS_COORDINATE,
    createdAt: NOW,
    dTag: 'meetups',
    description: 'Local meetups and workshops',
    eventCoordinates: [MEETUP.coordinate],
    id: 'meetups'.padEnd(64, '2'),
    pubkey: ME_HEX,
    title: 'Meetups'
  },
  {
    coordinate: TRAVEL_COORDINATE,
    createdAt: NOW,
    dTag: 'travel',
    description: '',
    eventCoordinates: [CONFERENCE.coordinate],
    id: 'travel'.padEnd(64, '3'),
    pubkey: ME_HEX,
    title: 'Travel'
  }
]

const REQUEST = timeEvent(
  'request',
  'Hackathon',
  9 * SECONDS_PER_DAY + 9 * SECONDS_PER_HOUR,
  8,
  {
    calendarCoordinates: [MEETUPS_COORDINATE],
    pubkey: BOB_HEX
  }
)

type DesignNostrCalendarSample = {
  data: NostrCalendarData
  detail: NostrCalendarEvent
  ownPubkey: string
  summary: NostrCalendarRsvpSummary
}

const EMPTY_SUMMARY: NostrCalendarRsvpSummary = {
  accepted: 0,
  declined: 0,
  tentative: 0
}

const STANDARD_SAMPLE: DesignNostrCalendarSample = {
  data: {
    calendars: CALENDARS,
    events: [PAST, HOLIDAY, MEETUP, CONFERENCE],
    foreignEvents: [CALL, REQUEST],
    invites: [CALL],
    requests: [REQUEST],
    rsvps: [
      {
        coordinate: getCalendarCoordinate(
          nostrKinds.CalendarEventRSVP,
          ME_HEX,
          CALL.coordinate
        ),
        createdAt: NOW,
        dTag: CALL.coordinate,
        eventCoordinate: CALL.coordinate,
        freeBusy: 'busy',
        id: 'rsvp'.padEnd(64, '4'),
        note: '',
        pubkey: ME_HEX,
        status: 'accepted'
      }
    ]
  },
  detail: MEETUP,
  ownPubkey: ME_HEX,
  summary: { accepted: 12, declined: 2, tentative: 4 }
}

const MINIMAL_SAMPLE: DesignNostrCalendarSample = {
  data: {
    calendars: [],
    events: [HOLIDAY],
    foreignEvents: [],
    invites: [],
    requests: [],
    rsvps: []
  },
  detail: HOLIDAY,
  ownPubkey: ME_HEX,
  summary: EMPTY_SUMMARY
}

const HEAVY_SAMPLE: DesignNostrCalendarSample = {
  data: {
    calendars: CALENDARS,
    events: [...HEAVY_EVENTS, MEETUP, CONFERENCE, PAST],
    foreignEvents: [CALL, REQUEST],
    invites: [CALL],
    requests: [REQUEST],
    rsvps: []
  },
  detail: { ...MEETUP, title: longTitle(0) },
  ownPubkey: ME_HEX,
  summary: { accepted: 340, declined: 57, tentative: 128 }
}

export const DESIGN_NOSTR_CALENDAR_SETS: DesignSampleSet<DesignNostrCalendarSample>[] =
  [
    { data: STANDARD_SAMPLE, name: 'standard' },
    { data: MINIMAL_SAMPLE, name: 'minimal' },
    { data: HEAVY_SAMPLE, name: 'heavy' }
  ]
