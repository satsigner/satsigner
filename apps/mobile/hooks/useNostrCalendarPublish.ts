import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner-native'

import {
  publishNostrCalendarTemplate,
  publishNostrCalendarTemplates
} from '@/api/nostrCalendar'
import { nostrKeys } from '@/db/keys'
import { t } from '@/locales'
import type {
  NostrCalendar,
  NostrCalendarData,
  NostrCalendarEvent,
  NostrCalendarEventDraft,
  NostrCalendarEventTemplate,
  NostrCalendarFreeBusy,
  NostrCalendarRawEvent,
  NostrCalendarRsvpStatus
} from '@/types/models/NostrCalendar'
import {
  applyPublishedCalendarEvents,
  buildCalendarDeletionTemplate,
  buildCalendarEventTemplate,
  buildCalendarTemplate,
  buildRsvpTemplate,
  getCalendarCoordinate,
  removeCalendarItem,
  toggleCalendarEvent
} from '@/utils/nostrCalendar'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'

import { EMPTY_CALENDAR_DATA } from './useNostrCalendarFetch'

type CalendarPublishContext = {
  nsec?: string
  ownPubkey: string
  relays: string[]
  relaysKey: string
}

type RsvpInput = {
  event: NostrCalendarEvent
  freeBusy?: NostrCalendarFreeBusy
  note: string
  status: NostrCalendarRsvpStatus
}

type CalendarInput = {
  calendar?: NostrCalendar
  description: string
  dTag: string
  title: string
}

class NostrCalendarDraftInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NostrCalendarDraftInvalidError'
  }
}

/** Calendars whose membership of `coordinate` must change to match `wanted`. */
function getMembershipTemplates(
  calendars: NostrCalendar[],
  coordinate: string,
  wanted: string[]
): NostrCalendarEventTemplate[] {
  return calendars.flatMap((calendar) => {
    const included = calendar.eventCoordinates.includes(coordinate)
    const shouldInclude = wanted.includes(calendar.coordinate)
    if (included === shouldInclude) {
      return []
    }
    const result = toggleCalendarEvent(calendar, coordinate, shouldInclude)
    return result.ok ? [result.template] : []
  })
}

function templateOrThrow(result: ReturnType<typeof buildCalendarTemplate>) {
  if (!result.ok) {
    throw new NostrCalendarDraftInvalidError(
      t(`nostrIdentity.calendar.error.${result.error}`)
    )
  }
  return result.template
}

/** Create, edit, delete, RSVP and calendar membership for one identity. */
function useNostrCalendarPublish({
  nsec,
  ownPubkey,
  relays,
  relaysKey
}: CalendarPublishContext) {
  const queryClient = useQueryClient()
  const dataKey = nostrKeys.identityCalendar(ownPubkey, relaysKey)

  function getData(): NostrCalendarData {
    return (
      queryClient.getQueryData<NostrCalendarData>(dataKey) ??
      EMPTY_CALENDAR_DATA
    )
  }

  function applyPublished(events: NostrCalendarRawEvent[]) {
    queryClient.setQueryData<NostrCalendarData>(dataKey, (current) =>
      applyPublishedCalendarEvents(current ?? EMPTY_CALENDAR_DATA, events)
    )
  }

  function publishAll(templates: NostrCalendarEventTemplate[]) {
    if (!nsec) {
      return Promise.reject(new Error(t('nostrIdentity.keys.watchOnly')))
    }
    return publishNostrCalendarTemplates(relays, nsec, templates)
  }

  function reportError(error: unknown) {
    const message =
      error instanceof NostrCalendarDraftInvalidError
        ? error.message
        : getNostrErrorMessage(error)
    toast.error(`${t('nostrIdentity.calendar.publishFailed')}: ${message}`)
  }

  const saveEvent = useMutation({
    mutationFn: (draft: NostrCalendarEventDraft) => {
      const template = templateOrThrow(buildCalendarEventTemplate(draft))
      const coordinate = getCalendarCoordinate(
        template.kind,
        ownPubkey,
        draft.dTag
      )
      const membership = getMembershipTemplates(
        getData().calendars,
        coordinate,
        draft.calendarCoordinates
      )
      return publishAll([template, ...membership])
    },
    onError: reportError,
    onSuccess: (published) => {
      applyPublished(published)
      toast.success(t('nostrIdentity.calendar.saved'))
    }
  })

  const deleteItem = useMutation({
    mutationFn: async (item: {
      coordinate: string
      id: string
      kind: number
    }) => {
      const detach = getData()
        .calendars.filter((calendar) =>
          calendar.eventCoordinates.includes(item.coordinate)
        )
        .flatMap((calendar) => {
          const result = toggleCalendarEvent(calendar, item.coordinate, false)
          return result.ok ? [result.template] : []
        })
      const published = await publishAll([
        buildCalendarDeletionTemplate(item),
        ...detach
      ])
      return { item, published }
    },
    onError: reportError,
    onSuccess: ({ item, published }) => {
      queryClient.setQueryData<NostrCalendarData>(dataKey, (current) =>
        removeCalendarItem(current ?? EMPTY_CALENDAR_DATA, item.coordinate)
      )
      applyPublished(published.slice(1))
      toast.success(t('nostrIdentity.calendar.deleted'))
    }
  })

  const rsvp = useMutation({
    mutationFn: (input: RsvpInput) => {
      if (!nsec) {
        return Promise.reject(new Error(t('nostrIdentity.keys.watchOnly')))
      }
      return publishNostrCalendarTemplate(
        relays,
        nsec,
        buildRsvpTemplate(input)
      )
    },
    onError: reportError,
    onSuccess: (published, input) => {
      applyPublished([published])
      void queryClient.invalidateQueries({
        queryKey: nostrKeys.identityCalendarRsvps(
          input.event.coordinate,
          relaysKey
        )
      })
      toast.success(t('nostrIdentity.calendar.rsvpSent'))
    }
  })

  const saveCalendar = useMutation({
    mutationFn: (input: CalendarInput) =>
      publishAll([
        templateOrThrow(
          buildCalendarTemplate({
            dTag: input.calendar?.dTag ?? input.dTag,
            description: input.description,
            eventCoordinates: input.calendar?.eventCoordinates ?? [],
            title: input.title
          })
        )
      ]),
    onError: reportError,
    onSuccess: (published) => {
      applyPublished(published)
      toast.success(t('nostrIdentity.calendar.calendarSaved'))
    }
  })

  const acceptRequest = useMutation({
    mutationFn: ({
      calendar,
      event
    }: {
      calendar: NostrCalendar
      event: NostrCalendarEvent
    }) =>
      publishAll([
        templateOrThrow(toggleCalendarEvent(calendar, event.coordinate, true))
      ]),
    onError: reportError,
    onSuccess: (published) => {
      applyPublished(published)
      toast.success(t('nostrIdentity.calendar.requestAccepted'))
    }
  })

  return {
    acceptRequest,
    deleteItem,
    rsvp,
    saveCalendar,
    saveEvent
  }
}

export { useNostrCalendarPublish }
