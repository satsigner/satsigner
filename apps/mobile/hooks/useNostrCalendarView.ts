import { useState } from 'react'

import { MS_PER_SECOND } from '@/constants/time'
import type {
  NostrCalendarData,
  NostrCalendarEvent,
  NostrCalendarRsvpStatus
} from '@/types/models/NostrCalendar'
import {
  buildMonthGrid,
  formatCalendarEventTime,
  formatCalendarEventWhen,
  formatDayTitle,
  formatMonthTitle,
  getDateKey,
  getDeviceTimezone,
  getMonthOfDateKey,
  getVisibleCalendarEvents,
  groupEventsByDay,
  isCalendarEventPast,
  shiftMonth
} from '@/utils/nostrCalendar'

type NostrCalendarViewMode = 'agenda' | 'month'

type CalendarRowItem = {
  dateLabel?: string
  event: NostrCalendarEvent
  invited: boolean
  past: boolean
  rsvpStatus?: NostrCalendarRsvpStatus
  timeLabel: string
}

function nowSeconds() {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function buildRows(
  events: NostrCalendarEvent[],
  data: NostrCalendarData,
  ownPubkey: string,
  timezone: string,
  withDate: boolean
): CalendarRowItem[] {
  const now = nowSeconds()
  const rsvpByEvent = new Map(
    data.rsvps.map((rsvp) => [rsvp.eventCoordinate, rsvp.status])
  )
  return events.map((event) => {
    const status = rsvpByEvent.get(event.coordinate)
    const when = formatCalendarEventWhen(event, timezone)
    return {
      ...(withDate
        ? { dateLabel: when.end ? `${when.start} → ${when.end}` : when.start }
        : {}),
      event,
      invited: event.pubkey !== ownPubkey,
      past: isCalendarEventPast(event, now),
      ...(status ? { rsvpStatus: status } : {}),
      timeLabel: formatCalendarEventTime(event, timezone)
    }
  })
}

/** Month grid, selected day, agenda and calendar filter for the screen. */
function useNostrCalendarView(data: NostrCalendarData, ownPubkey: string) {
  const [timezone] = useState(getDeviceTimezone)
  const [todayKey] = useState(() => getDateKey(nowSeconds(), timezone))
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [month, setMonth] = useState(() => getMonthOfDateKey(todayKey))
  const [mode, setMode] = useState<NostrCalendarViewMode>('month')
  const [calendarFilter, setCalendarFilter] = useState<string>()

  const visible = getVisibleCalendarEvents(data, calendarFilter)
  const byDay = groupEventsByDay(visible, timezone)
  const eventCounts = new Map(
    [...byDay].map(([key, events]) => [key, events.length])
  )
  const dayRows = buildRows(
    byDay.get(selectedKey) ?? [],
    data,
    ownPubkey,
    timezone,
    false
  )
  const now = nowSeconds()
  const upcoming = visible.filter((event) => !isCalendarEventPast(event, now))
  const past = visible
    .filter((event) => isCalendarEventPast(event, now))
    .toReversed()

  function handleSelectDay(dateKey: string) {
    setSelectedKey(dateKey)
    setMonth(getMonthOfDateKey(dateKey))
  }

  function handlePreviousMonth() {
    setMonth((current) => shiftMonth(current, -1))
  }

  function handleNextMonth() {
    setMonth((current) => shiftMonth(current, 1))
  }

  function handleToday() {
    handleSelectDay(todayKey)
  }

  return {
    agendaPastRows: buildRows(past, data, ownPubkey, timezone, true),
    agendaUpcomingRows: buildRows(upcoming, data, ownPubkey, timezone, true),
    calendarFilter,
    dayRows,
    dayTitle: formatDayTitle(selectedKey),
    eventCounts,
    gridDays: buildMonthGrid(month),
    handleNextMonth,
    handlePreviousMonth,
    handleSelectDay,
    handleToday,
    mode,
    monthTitle: formatMonthTitle(month),
    selectedKey,
    setCalendarFilter,
    setMode,
    timezone,
    todayKey
  }
}

export type { CalendarRowItem, NostrCalendarViewMode }
export { useNostrCalendarView }
