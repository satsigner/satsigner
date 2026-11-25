// Real nostr-tools: participants are checked by decoding real npubs.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

import { nip19 } from 'nostr-tools'

import { MS_PER_SECOND } from '@/constants/time'
import type { NostrCalendarEventDraft } from '@/types/models/NostrCalendar'
import {
  applyPublishedCalendarEvent,
  buildCalendarData,
  buildCalendarDeletionTemplate,
  buildCalendarEventTemplate,
  buildCalendarTemplate,
  buildMonthGrid,
  buildRsvpTemplate,
  CALENDAR_HOUR_OPTIONS,
  CALENDAR_MINUTE_OPTIONS,
  draftFromCalendarEvent,
  emptyCalendarEventDraft,
  formatDateKeyLabel,
  formatTimeKey,
  getEventDayKeys,
  getPickerMonth,
  getVisibleCalendarEvents,
  groupEventsByDay,
  isCalendarEventPast,
  parseCalendar,
  parseCalendarDate,
  parseCalendarEvent,
  parseCalendarRsvp,
  parseTimeKey,
  shiftMonth,
  summarizeRsvps,
  zonedTimeToUnix
} from '@/utils/nostrCalendar'

describe('parseCalendarDate', () => {
  it('reads NIP-52 dates as UTC midnight', () => {
    expect(parseCalendarDate('2026-11-20')).toBe(
      Date.UTC(2026, 10, 20) / MS_PER_SECOND
    )
  })

  it('reads unix seconds written by other clients', () => {
    expect(parseCalendarDate('1795000000')).toBe(1_795_000_000)
    expect(parseCalendarDate('-86400')).toBe(-86_400)
  })

  it('rejects missing, malformed and impossible dates', () => {
    expect(parseCalendarDate(undefined)).toBeNull()
    expect(parseCalendarDate('')).toBeNull()
    expect(parseCalendarDate('20 Nov 2026')).toBeNull()
    expect(parseCalendarDate('2026-13-01')).toBeNull()
    expect(parseCalendarDate('2026-02-30')).toBeNull()
    expect(parseCalendarDate('9'.repeat(400))).toBeNull()
    expect(parseCalendarDate('9999999999999999')).toBeNull()
  })

  it('keeps years below 100', () => {
    const date = new Date(0)
    date.setUTCFullYear(99, 0, 1)
    expect(parseCalendarDate('0099-01-01')).toBe(date.getTime() / MS_PER_SECOND)
  })
})

// Built at runtime so linters don't flag a script URL literal.
const UNSAFE_URL = ['javascript', 'alert(1)'].join(':')
const ME = '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e'
const ALICE = 'a1f3c5d7e9b2a4c6e8f0a1b3c5d7e9f1a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2'
const DAY = 86_400

function raw(
  kind: number,
  tags: string[][],
  {
    content = '',
    createdAt = 100,
    id = 'a'.repeat(64),
    pubkey = ME
  }: { content?: string; createdAt?: number; id?: string; pubkey?: string } = {}
) {
  return { content, created_at: createdAt, id, kind, pubkey, tags }
}

function draft(changes: Partial<NostrCalendarEventDraft> = {}) {
  return {
    ...emptyCalendarEventDraft({
      dTag: 'evt',
      startDate: '2026-11-20',
      timezone: 'UTC'
    }),
    title: 'Meetup',
    ...changes
  }
}

describe('parseCalendarEvent', () => {
  it('reads a date-based event with every NIP-52 tag', () => {
    const event = parseCalendarEvent(
      raw(
        31_922,
        [
          ['d', 'trip'],
          ['title', 'Trip'],
          ['start', '2026-11-20'],
          ['end', '2026-11-23'],
          ['location', 'Riga'],
          ['location', 'Room 2'],
          ['p', ALICE, 'wss://relay', 'host'],
          ['p', 'not-a-pubkey'],
          ['t', 'travel'],
          ['r', 'https://example.com'],
          ['r', UNSAFE_URL],
          ['image', 'ftp://x'],
          ['a', `31924:${ME}:work`],
          ['a', '1:abc:def']
        ],
        { content: 'Notes' }
      )
    )
    expect(event).toMatchObject({
      allDay: true,
      calendarCoordinates: [`31924:${ME}:work`],
      coordinate: `31922:${ME}:trip`,
      description: 'Notes',
      end: Date.UTC(2026, 10, 23) / MS_PER_SECOND,
      hashtags: ['travel'],
      locations: ['Riga', 'Room 2'],
      participants: [{ pubkey: ALICE, relay: 'wss://relay', role: 'host' }],
      references: ['https://example.com'],
      start: Date.UTC(2026, 10, 20) / MS_PER_SECOND,
      title: 'Trip'
    })
    expect(event?.image).toBeUndefined()
  })

  it('reads a time-based event and its time zones', () => {
    const event = parseCalendarEvent(
      raw(31_923, [
        ['d', 'call'],
        ['name', 'Old name tag'],
        ['start', '1795000000'],
        ['end', '1795003600'],
        ['start_tzid', 'Europe/Lisbon']
      ])
    )
    expect(event).toMatchObject({
      allDay: false,
      end: 1_795_003_600,
      endTzid: 'Europe/Lisbon',
      start: 1_795_000_000,
      startTzid: 'Europe/Lisbon',
      title: 'Old name tag'
    })
  })

  it('drops an end that is not after the start', () => {
    const event = parseCalendarEvent(
      raw(31_923, [
        ['d', 'x'],
        ['start', '100'],
        ['end', '50']
      ])
    )
    expect(event?.end).toBeUndefined()
  })

  it('rejects events without d or start, and other kinds', () => {
    expect(
      parseCalendarEvent(raw(31_922, [['start', '2026-11-20']]))
    ).toBeNull()
    expect(parseCalendarEvent(raw(31_922, [['d', 'x']]))).toBeNull()
    expect(
      parseCalendarEvent(
        raw(31_923, [
          ['d', 'x'],
          ['start', '2026-11-20']
        ])
      )
    ).toBeNull()
    expect(parseCalendarEvent(raw(1, [['d', 'x']]))).toBeNull()
  })
})

describe('parseCalendar and parseCalendarRsvp', () => {
  it('keeps only calendar event coordinates in a calendar', () => {
    const calendar = parseCalendar(
      raw(31_924, [
        ['d', 'work'],
        ['title', 'Work'],
        ['a', `31923:${ALICE}:call`],
        ['a', `31923:${ALICE}:call`],
        ['a', `30023:${ALICE}:article`]
      ])
    )
    expect(calendar?.eventCoordinates).toStrictEqual([`31923:${ALICE}:call`])
  })

  it('ignores free/busy on a declined RSVP', () => {
    const rsvp = parseCalendarRsvp(
      raw(31_925, [
        ['d', 'r'],
        ['a', `31923:${ALICE}:call`],
        ['status', 'declined'],
        ['fb', 'busy']
      ])
    )
    expect(rsvp?.status).toBe('declined')
    expect(rsvp?.freeBusy).toBeUndefined()
  })

  it('rejects RSVPs with an unknown status', () => {
    expect(
      parseCalendarRsvp(
        raw(31_925, [
          ['d', 'r'],
          ['a', `31923:${ALICE}:call`],
          ['status', 'maybe']
        ])
      )
    ).toBeNull()
  })
})

describe('buildCalendarData', () => {
  const v1 = raw(
    31_922,
    [
      ['d', 'a'],
      ['title', 'Old'],
      ['start', '2026-11-20']
    ],
    { createdAt: 100, id: '1'.repeat(64) }
  )
  const v2 = raw(
    31_922,
    [
      ['d', 'a'],
      ['title', 'New'],
      ['start', '2026-11-21']
    ],
    { createdAt: 200, id: '2'.repeat(64) }
  )

  it('keeps the newest revision of each addressable event', () => {
    const data = buildCalendarData({
      deletions: [],
      foreign: [],
      own: [v2, v1],
      ownPubkey: ME
    })
    expect(data.events.map((event) => event.title)).toStrictEqual(['New'])
  })

  it('hides revisions deleted by coordinate up to the deletion time', () => {
    const deletion = {
      created_at: 150,
      pubkey: ME,
      tags: [['a', `31922:${ME}:a`]]
    }
    const onlyOld = buildCalendarData({
      deletions: [deletion],
      foreign: [],
      own: [v1],
      ownPubkey: ME
    })
    expect(onlyOld.events).toHaveLength(0)
    const withNew = buildCalendarData({
      deletions: [deletion],
      foreign: [],
      own: [v1, v2],
      ownPubkey: ME
    })
    expect(withNew.events.map((event) => event.title)).toStrictEqual(['New'])
  })

  it('ignores deletions by anyone but the author', () => {
    const data = buildCalendarData({
      deletions: [
        { created_at: 999, pubkey: ALICE, tags: [['a', `31922:${ME}:a`]] },
        { created_at: 999, pubkey: ALICE, tags: [['e', v2.id]] }
      ],
      foreign: [],
      own: [v2],
      ownPubkey: ME
    })
    expect(data.events).toHaveLength(1)
  })

  it('splits invites from requests to join own calendars', () => {
    const calendar = raw(31_924, [
      ['d', 'work'],
      ['title', 'Work']
    ])
    const invite = raw(
      31_923,
      [
        ['d', 'call'],
        ['start', '100'],
        ['p', ME]
      ],
      { pubkey: ALICE }
    )
    const request = raw(
      31_923,
      [
        ['d', 'hack'],
        ['start', '200'],
        ['a', `31924:${ME}:work`]
      ],
      { id: 'b'.repeat(64), pubkey: ALICE }
    )
    const data = buildCalendarData({
      deletions: [],
      foreign: [invite, request],
      own: [calendar],
      ownPubkey: ME
    })
    expect(data.invites.map((event) => event.dTag)).toStrictEqual(['call'])
    expect(data.requests.map((event) => event.dTag)).toStrictEqual(['hack'])
    const accepted = applyPublishedCalendarEvent(
      data,
      raw(
        31_924,
        [
          ['d', 'work'],
          ['title', 'Work'],
          ['a', `31923:${ALICE}:hack`]
        ],
        { createdAt: 300, id: 'c'.repeat(64) }
      )
    )
    expect(accepted.requests).toHaveLength(0)
    expect(getVisibleCalendarEvents(accepted, `31924:${ME}:work`)).toHaveLength(
      0
    )
  })
})

describe('summarizeRsvps', () => {
  it("counts each author's newest answer once", () => {
    const base = {
      coordinate: 'c',
      dTag: 'd',
      eventCoordinate: 'e',
      id: 'i',
      note: ''
    }
    expect(
      summarizeRsvps([
        { ...base, createdAt: 1, pubkey: ME, status: 'tentative' },
        { ...base, createdAt: 2, pubkey: ME, status: 'accepted' },
        { ...base, createdAt: 1, pubkey: ALICE, status: 'declined' }
      ])
    ).toStrictEqual({ accepted: 1, declined: 1, tentative: 0 })
  })
})

describe('buildCalendarEventTemplate', () => {
  it('writes an exclusive end date for all-day events', () => {
    const result = buildCalendarEventTemplate(draft({ endDate: '2026-11-22' }))
    expect(result.ok && result.template.kind).toBe(31_922)
    expect(result.ok && result.template.tags).toStrictEqual(
      expect.arrayContaining([
        ['d', 'evt'],
        ['title', 'Meetup'],
        ['start', '2026-11-20'],
        ['end', '2026-11-23']
      ])
    )
  })

  it('writes unix times, the time zone and D tags for timed events', () => {
    const result = buildCalendarEventTemplate(
      draft({
        allDay: false,
        endDate: '2026-11-21',
        endTime: '01:00',
        startTime: '23:00',
        timezone: 'Europe/Lisbon'
      })
    )
    if (!result.ok) {
      throw new Error(result.error)
    }
    const start = Date.UTC(2026, 10, 20, 23) / MS_PER_SECOND
    expect(result.template.kind).toBe(31_923)
    expect(result.template.tags).toStrictEqual(
      expect.arrayContaining([
        ['start', String(start)],
        ['end', String(start + 2 * 3600)],
        ['start_tzid', 'Europe/Lisbon'],
        ['D', String(Math.floor(start / DAY))],
        ['D', String(Math.floor(start / DAY) + 1)]
      ])
    )
  })

  it('converts wall-clock time across a DST offset', () => {
    expect(zonedTimeToUnix('2026-07-01', '12:00', 'Europe/Lisbon')).toBe(
      Date.UTC(2026, 6, 1, 11) / MS_PER_SECOND
    )
    expect(zonedTimeToUnix('2026-01-01', '12:00', 'America/New_York')).toBe(
      Date.UTC(2026, 0, 1, 17) / MS_PER_SECOND
    )
  })

  it('normalises participants, hashtags and links', () => {
    const result = buildCalendarEventTemplate(
      draft({
        hashtags: '#Bitcoin, meetup',
        participants: `${nip19.npubEncode(ALICE)}\n${ALICE}`,
        references: 'https://a.example\nhttps://a.example'
      })
    )
    expect(result.ok && result.template.tags).toStrictEqual(
      expect.arrayContaining([
        ['p', ALICE],
        ['t', 'bitcoin'],
        ['t', 'meetup'],
        ['r', 'https://a.example']
      ])
    )
    const pTags = result.ok
      ? result.template.tags.filter((tag) => tag[0] === 'p')
      : []
    expect(pTags).toHaveLength(1)
  })

  it.each([
    [{ title: '  ' }, 'titleRequired'],
    [{ startDate: '2026-02-30' }, 'invalidStartDate'],
    [{ endDate: '2026-11-19' }, 'endBeforeStart'],
    [{ allDay: false, startTime: '25:00' }, 'invalidStartTime'],
    [{ allDay: false, endTime: '08:00', startTime: '09:00' }, 'endBeforeStart'],
    [{ participants: 'npub1nope' }, 'invalidParticipant'],
    [{ image: UNSAFE_URL }, 'invalidImage'],
    [{ references: 'file:///etc/passwd' }, 'invalidLink']
  ] as const)('rejects %j with %s', (changes, error) => {
    expect(buildCalendarEventTemplate(draft(changes))).toStrictEqual({
      error,
      ok: false
    })
  })

  it('round-trips an event through the edit draft', () => {
    const result = buildCalendarEventTemplate(
      draft({
        allDay: false,
        endTime: '10:30',
        locations: 'Lisbon',
        startTime: '09:00',
        timezone: 'Europe/Lisbon'
      })
    )
    if (!result.ok) {
      throw new Error(result.error)
    }
    const event = parseCalendarEvent({
      ...result.template,
      created_at: 1,
      id: 'f'.repeat(64),
      pubkey: ME
    })
    if (!event) {
      throw new Error('not parsed')
    }
    expect(draftFromCalendarEvent(event, 'UTC')).toMatchObject({
      endDate: '',
      endTime: '10:30',
      locations: 'Lisbon',
      startDate: '2026-11-20',
      startTime: '09:00',
      timezone: 'Europe/Lisbon'
    })
  })
})

describe('other templates', () => {
  const event = {
    coordinate: `31923:${ALICE}:call`,
    id: 'e'.repeat(64),
    pubkey: ALICE
  }

  it('builds an RSVP that replaces earlier answers to the same event', () => {
    expect(
      buildRsvpTemplate({
        event,
        freeBusy: 'busy',
        note: ' ok ',
        status: 'accepted'
      })
    ).toStrictEqual({
      content: 'ok',
      kind: 31_925,
      tags: [
        ['d', event.coordinate],
        ['a', event.coordinate],
        ['e', event.id],
        ['p', ALICE],
        ['status', 'accepted'],
        ['fb', 'busy']
      ]
    })
    const declined = buildRsvpTemplate({
      event,
      freeBusy: 'busy',
      note: '',
      status: 'declined'
    })
    expect(declined.tags.some((tag) => tag[0] === 'fb')).toBe(false)
  })

  it('deletes by coordinate and id', () => {
    expect(
      buildCalendarDeletionTemplate({ ...event, kind: 31_923 }).tags
    ).toStrictEqual([
      ['a', event.coordinate],
      ['e', event.id],
      ['k', '31923']
    ])
  })

  it('builds a calendar with unique event references', () => {
    const result = buildCalendarTemplate({
      dTag: 'work',
      description: '',
      eventCoordinates: [event.coordinate, event.coordinate],
      title: 'Work'
    })
    expect(result.ok && result.template.tags).toStrictEqual([
      ['d', 'work'],
      ['title', 'Work'],
      ['a', event.coordinate]
    ])
  })
})

describe('month grid and day grouping', () => {
  it('builds six weeks starting on Sunday', () => {
    const grid = buildMonthGrid({ month: 11, year: 2026 })
    expect(grid).toHaveLength(42)
    expect(grid[0]).toStrictEqual({
      dateKey: '2026-11-01',
      day: 1,
      inMonth: true
    })
    expect(grid.at(-1)?.inMonth).toBe(false)
  })

  it('wraps months across years', () => {
    expect(shiftMonth({ month: 12, year: 2026 }, 1)).toStrictEqual({
      month: 1,
      year: 2027
    })
    expect(shiftMonth({ month: 1, year: 2026 }, -1)).toStrictEqual({
      month: 12,
      year: 2025
    })
  })

  it('places all-day events on their UTC days, end exclusive', () => {
    const start = Date.UTC(2026, 10, 20) / MS_PER_SECOND
    expect(
      getEventDayKeys(
        { allDay: true, end: start + 2 * DAY, start },
        'Asia/Tokyo'
      )
    ).toStrictEqual(['2026-11-20', '2026-11-21'])
  })

  it('places timed events on local days', () => {
    const start = Date.UTC(2026, 10, 20, 23, 30) / MS_PER_SECOND
    expect(
      getEventDayKeys({ allDay: false, end: start + 3600, start }, 'Asia/Tokyo')
    ).toStrictEqual(['2026-11-21'])
    const event = parseCalendarEvent(
      raw(31_923, [
        ['d', 'x'],
        ['start', String(start)]
      ])
    )
    expect(
      groupEventsByDay(event ? [event] : [], 'UTC').get('2026-11-20')
    ).toHaveLength(1)
  })

  it('treats an all-day event as past only after its last day', () => {
    const start = Date.UTC(2026, 10, 20) / MS_PER_SECOND
    expect(isCalendarEventPast({ allDay: true, start }, start + 3600)).toBe(
      false
    )
    expect(isCalendarEventPast({ allDay: true, start }, start + DAY)).toBe(true)
  })
})

describe('picker helpers', () => {
  it('lists every hour and minute, zero padded', () => {
    expect(CALENDAR_HOUR_OPTIONS).toHaveLength(24)
    expect(CALENDAR_HOUR_OPTIONS[0]).toBe('00')
    expect(CALENDAR_HOUR_OPTIONS.at(-1)).toBe('23')
    expect(CALENDAR_MINUTE_OPTIONS).toHaveLength(60)
    expect(CALENDAR_MINUTE_OPTIONS.at(-1)).toBe('59')
  })

  it('reads and writes HH:MM', () => {
    expect(parseTimeKey('09:05')).toStrictEqual({ hours: 9, minutes: 5 })
    expect(parseTimeKey('24:00')).toBeNull()
    expect(parseTimeKey('')).toBeNull()
    expect(formatTimeKey(7, 3)).toBe('07:03')
  })

  it('labels only real dates', () => {
    expect(formatDateKeyLabel('2026-11-20')).toBeTruthy()
    expect(formatDateKeyLabel('')).toBeUndefined()
    expect(formatDateKeyLabel('2026-02-30')).toBeUndefined()
  })

  it('opens on the value month, else the fallback month', () => {
    expect(getPickerMonth('2026-03-10', '2026-11-25')).toStrictEqual({
      month: 3,
      year: 2026
    })
    expect(getPickerMonth('', '2026-11-25')).toStrictEqual({
      month: 11,
      year: 2026
    })
  })
})
