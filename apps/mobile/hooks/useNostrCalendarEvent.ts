import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import type {
  NostrCalendarFreeBusy,
  NostrCalendarRsvpStatus
} from '@/types/models/NostrCalendar'
import { formatNpub } from '@/utils/format'
import { safeNpubEncode } from '@/utils/nostr'
import {
  encodeCalendarAddress,
  findCalendarEvent,
  findOwnRsvp,
  formatCalendarEventWhen,
  getDeviceTimezone,
  summarizeRsvps
} from '@/utils/nostrCalendar'

import {
  useNostrCalendarFetch,
  useNostrCalendarRsvpsFetch
} from './useNostrCalendarFetch'
import { useNostrCalendarPublish } from './useNostrCalendarPublish'
import { useNostrProfilesFetch } from './useNostrProfilesFetch'

function getProfileLabel(
  pubkey: string,
  profiles: Record<string, { displayName?: string } | null>
): string {
  return profiles[pubkey]?.displayName || formatNpub(safeNpubEncode(pubkey))
}

/** Everything the calendar event screen shows and does. */
function useNostrCalendarEvent(npub: string, coordinate: string) {
  const calendar = useNostrCalendarFetch(npub)
  const { data, ownPubkey, relays } = calendar
  const event = findCalendarEvent(data, coordinate)
  const { isLoading: rsvpsLoading, rsvps } = useNostrCalendarRsvpsFetch(
    event,
    relays
  )
  const publish = useNostrCalendarPublish({
    nsec: calendar.identity?.nsec,
    ownPubkey,
    relays,
    relaysKey: calendar.relaysKey
  })
  const [timezone] = useState(getDeviceTimezone)

  const ownRsvp = findOwnRsvp([...data.rsvps, ...rsvps], coordinate, ownPubkey)
  const [status, setStatus] = useState<NostrCalendarRsvpStatus | undefined>(
    ownRsvp?.status
  )
  const [freeBusy, setFreeBusy] = useState<NostrCalendarFreeBusy | undefined>(
    ownRsvp?.freeBusy
  )
  const [note, setNote] = useState(ownRsvp?.note ?? '')

  const profilePubkeys = event
    ? [event.pubkey, ...event.participants.map(({ pubkey }) => pubkey)]
    : []
  const profiles = useNostrProfilesFetch(profilePubkeys, relays)

  const isOwn = event?.pubkey === ownPubkey
  const calendarTitles = data.calendars
    .filter((item) => item.eventCoordinates.includes(coordinate))
    .map((item) => item.title)

  function handleSubmitRsvp() {
    if (!event || !status) {
      return
    }
    publish.rsvp.mutate({ event, freeBusy, note, status })
  }

  async function handleCopyAddress() {
    if (!event) {
      return
    }
    await Clipboard.setStringAsync(
      `nostr:${encodeCalendarAddress(event, relays)}`
    )
    toast.success(t('common.copiedToClipboard'))
  }

  function handleDelete(onDeleted: () => void) {
    if (!event || !isOwn) {
      return
    }
    publish.deleteItem.mutate(event, { onSuccess: onDeleted })
  }

  return {
    calendarTitles,
    canEdit: isOwn && calendar.canWrite,
    canRespond: calendar.canWrite,
    deleting: publish.deleteItem.isPending,
    event,
    freeBusy,
    handleCopyAddress,
    handleDelete,
    handleSubmitRsvp,
    isLoading: calendar.isLoading,
    note,
    organizerLabel: event ? getProfileLabel(event.pubkey, profiles) : '',
    participants: (event?.participants ?? []).map((participant) => ({
      label: getProfileLabel(participant.pubkey, profiles),
      pubkey: participant.pubkey,
      ...(participant.role ? { role: participant.role } : {})
    })),
    rsvpSending: publish.rsvp.isPending,
    rsvpsLoading,
    sentStatus: ownRsvp?.status,
    setFreeBusy,
    setNote,
    setStatus,
    status,
    summary: summarizeRsvps(rsvps),
    timezoneLabel:
      event && !event.allDay
        ? t('nostrIdentity.calendar.shownIn', { timezone })
        : undefined,
    when: event ? formatCalendarEventWhen(event, timezone) : { start: '' }
  }
}

export { useNostrCalendarEvent }
