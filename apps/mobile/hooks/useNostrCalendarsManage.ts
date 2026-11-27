import * as nostrKinds from 'nostr-tools/kinds'
import { useState } from 'react'

import type { CalendarRequest } from '@/components/SSNostrCalendarList'
import type { NostrCalendar } from '@/types/models/NostrCalendar'
import { randomUuid } from '@/utils/crypto'
import {
  formatCalendarEventWhen,
  getDeviceTimezone
} from '@/utils/nostrCalendar'

import { useNostrCalendarFetch } from './useNostrCalendarFetch'
import { useNostrCalendarPublish } from './useNostrCalendarPublish'

type CalendarEditorState = {
  calendar?: NostrCalendar
  description: string
  dTag: string
  title: string
}

/** Calendars (kind 31924): list, create, rename, delete, accept requests. */
function useNostrCalendarsManage(npub: string) {
  const calendar = useNostrCalendarFetch(npub)
  const { data } = calendar
  const publish = useNostrCalendarPublish({
    nsec: calendar.identity?.nsec,
    ownPubkey: calendar.ownPubkey,
    relays: calendar.relays,
    relaysKey: calendar.relaysKey
  })
  const [timezone] = useState(getDeviceTimezone)
  const [editor, setEditor] = useState<CalendarEditorState>()

  const requests: CalendarRequest[] = data.requests.flatMap((event) =>
    data.calendars
      .filter(
        (item) =>
          event.calendarCoordinates.includes(item.coordinate) &&
          !item.eventCoordinates.includes(event.coordinate)
      )
      .map((item) => {
        const when = formatCalendarEventWhen(event, timezone)
        return {
          calendar: item,
          event,
          whenLabel: when.end ? `${when.start} → ${when.end}` : when.start
        }
      })
  )

  function handleNewCalendar() {
    setEditor({ dTag: randomUuid(), description: '', title: '' })
  }

  function handleEditCalendar(item: NostrCalendar) {
    setEditor({
      calendar: item,
      dTag: item.dTag,
      description: item.description,
      title: item.title
    })
  }

  function handleChangeEditor(changes: Partial<CalendarEditorState>) {
    setEditor((current) => (current ? { ...current, ...changes } : current))
  }

  function handleCloseEditor() {
    setEditor(undefined)
  }

  function handleSaveEditor() {
    if (!editor) {
      return
    }
    publish.saveCalendar.mutate(editor, { onSuccess: handleCloseEditor })
  }

  function handleDeleteCalendar() {
    const target = editor?.calendar
    if (!target) {
      return
    }
    publish.deleteItem.mutate(
      {
        coordinate: target.coordinate,
        id: target.id,
        kind: nostrKinds.Calendar
      },
      { onSuccess: handleCloseEditor }
    )
  }

  function handleAcceptRequest(request: CalendarRequest) {
    publish.acceptRequest.mutate(request)
  }

  return {
    calendars: data.calendars,
    canWrite: calendar.canWrite,
    deleting: publish.deleteItem.isPending,
    editor,
    handleAcceptRequest,
    handleChangeEditor,
    handleCloseEditor,
    handleDeleteCalendar,
    handleEditCalendar,
    handleNewCalendar,
    handleSaveEditor,
    isLoading: calendar.isLoading,
    requests,
    saving: publish.saveCalendar.isPending
  }
}

export type { CalendarEditorState }
export { useNostrCalendarsManage }
