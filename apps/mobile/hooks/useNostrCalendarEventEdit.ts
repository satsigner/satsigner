import { useState } from 'react'

import {
  NOSTR_CALENDAR_DEFAULT_END_TIME,
  NOSTR_CALENDAR_DEFAULT_START_TIME
} from '@/constants/nostrCalendar'
import { MS_PER_SECOND } from '@/constants/time'
import { t } from '@/locales'
import type { NostrCalendarEventDraft } from '@/types/models/NostrCalendar'
import { randomUuid } from '@/utils/crypto'
import {
  buildCalendarEventTemplate,
  draftFromCalendarEvent,
  emptyCalendarEventDraft,
  getDateKey,
  getDeviceTimezone
} from '@/utils/nostrCalendar'

import { useNostrCalendarFetch } from './useNostrCalendarFetch'
import { useNostrCalendarPublish } from './useNostrCalendarPublish'

function newDraft(startDate: string | undefined): NostrCalendarEventDraft {
  const timezone = getDeviceTimezone()
  return emptyCalendarEventDraft({
    dTag: randomUuid(),
    startDate:
      startDate ?? getDateKey(Math.floor(Date.now() / MS_PER_SECOND), timezone),
    timezone
  })
}

/**
 * Form state for creating an event, or editing the own one at `coordinate`.
 * Editing republishes under the same `d` tag, so the new revision replaces
 * the old one.
 */
function useNostrCalendarEventEdit(
  npub: string,
  { coordinate, date }: { coordinate?: string; date?: string }
) {
  const calendar = useNostrCalendarFetch(npub)
  const { data, ownPubkey } = calendar
  const existing = coordinate
    ? data.events.find((event) => event.coordinate === coordinate)
    : undefined
  const publish = useNostrCalendarPublish({
    nsec: calendar.identity?.nsec,
    ownPubkey,
    relays: calendar.relays,
    relaysKey: calendar.relaysKey
  })
  const [draft, setDraft] = useState(() =>
    existing
      ? draftFromCalendarEvent(existing, getDeviceTimezone())
      : newDraft(date)
  )
  const [submitted, setSubmitted] = useState(false)

  const validation = buildCalendarEventTemplate(draft)
  const error =
    submitted && !validation.ok
      ? t(`nostrIdentity.calendar.error.${validation.error}`)
      : undefined

  function handleChange(changes: Partial<NostrCalendarEventDraft>) {
    setDraft((current) => {
      const next = { ...current, ...changes }
      const switchedToTimed = changes.allDay === false && !current.startTime
      return switchedToTimed
        ? {
            ...next,
            endTime: NOSTR_CALENDAR_DEFAULT_END_TIME,
            startTime: NOSTR_CALENDAR_DEFAULT_START_TIME
          }
        : next
    })
  }

  function handleSave(onSaved: () => void) {
    setSubmitted(true)
    if (!validation.ok) {
      return
    }
    publish.saveEvent.mutate(draft, { onSuccess: onSaved })
  }

  return {
    calendars: data.calendars,
    canWrite: calendar.canWrite,
    draft,
    error,
    handleChange,
    handleSave,
    isEditing: Boolean(existing),
    isLoading: calendar.isLoading,
    missing: Boolean(coordinate) && !calendar.isLoading && !existing,
    saving: publish.saveEvent.isPending
  }
}

export { useNostrCalendarEventEdit }
