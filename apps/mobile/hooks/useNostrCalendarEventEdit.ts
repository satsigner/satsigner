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
  findCalendarEvent,
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
 *
 * An edit starts from the event whenever it shows up, also after a failed
 * first fetch: until the user changes something the draft is the event's,
 * never a blank one with a new `d` tag.
 */
function useNostrCalendarEventEdit(
  npub: string,
  { coordinate, date }: { coordinate?: string; date?: string }
) {
  const calendar = useNostrCalendarFetch(npub)
  const { data, ownPubkey } = calendar
  const found = coordinate ? findCalendarEvent(data, coordinate) : undefined
  const existing = found?.pubkey === ownPubkey ? found : undefined
  const publish = useNostrCalendarPublish({
    nsec: calendar.identity?.nsec,
    ownPubkey,
    relays: calendar.relays,
    relaysKey: calendar.relaysKey
  })
  const [createDraft] = useState(() => newDraft(date))
  const [edited, setEdited] = useState<NostrCalendarEventDraft | null>(null)
  const isEdit = Boolean(coordinate)
  const baseDraft = existing
    ? draftFromCalendarEvent(existing, getDeviceTimezone())
    : createDraft
  const draft = edited ?? baseDraft
  const canSave = !isEdit || Boolean(existing)
  const [submitted, setSubmitted] = useState(false)
  const [todayKey] = useState(() =>
    getDateKey(Math.floor(Date.now() / MS_PER_SECOND), getDeviceTimezone())
  )

  const validation = buildCalendarEventTemplate(draft)
  const error =
    submitted && !validation.ok
      ? t(`nostrIdentity.calendar.error.${validation.error}`)
      : undefined

  function handleChange(changes: Partial<NostrCalendarEventDraft>) {
    if (!canSave) {
      return
    }
    setEdited((value) => {
      const current = value ?? baseDraft
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
    if (!validation.ok || !canSave) {
      return
    }
    publish.saveEvent.mutate(
      {
        draft,
        ...(existing
          ? {
              previous: {
                coordinate: existing.coordinate,
                id: existing.id,
                kind: existing.kind
              }
            }
          : {})
      },
      { onSuccess: onSaved }
    )
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
    missing: isEdit && !calendar.isLoading && !existing,
    saving: publish.saveEvent.isPending,
    todayKey
  }
}

export { useNostrCalendarEventEdit }
