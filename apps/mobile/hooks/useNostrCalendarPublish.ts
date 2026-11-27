import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner-native'

import {
  NostrCalendarPartialPublishError,
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

type CalendarItemRef = { coordinate: string; id: string; kind: number }

type SaveEventInput = {
  draft: NostrCalendarEventDraft
  /** The event being edited, when there is one. */
  previous?: CalendarItemRef
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

/**
 * Calendars whose membership of `coordinate` must change to match `wanted`.
 * `replaced` is an address the event left (its kind changed), dropped from
 * every calendar in the same revision.
 */
function getMembershipTemplates(
  calendars: NostrCalendar[],
  coordinate: string,
  wanted: string[],
  replaced?: string
): NostrCalendarEventTemplate[] {
  return calendars.flatMap((calendar) => {
    const hasReplaced =
      replaced !== undefined && calendar.eventCoordinates.includes(replaced)
    const included = calendar.eventCoordinates.includes(coordinate)
    const shouldInclude = wanted.includes(calendar.coordinate)
    if (included === shouldInclude && !hasReplaced) {
      return []
    }
    const current = hasReplaced
      ? {
          ...calendar,
          eventCoordinates: calendar.eventCoordinates.filter(
            (item) => item !== replaced
          )
        }
      : calendar
    const result = toggleCalendarEvent(current, coordinate, shouldInclude)
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

  /**
   * Writes to the calendar cache. A fetch already running read the relays
   * before this publish, so it is cancelled first and can't overwrite it.
   */
  async function updateData(
    update: (current: NostrCalendarData) => NostrCalendarData
  ) {
    await queryClient.cancelQueries({ queryKey: dataKey })
    queryClient.setQueryData<NostrCalendarData>(dataKey, (current) =>
      update(current ?? EMPTY_CALENDAR_DATA)
    )
  }

  function applyPublished(events: NostrCalendarRawEvent[]) {
    return updateData((current) =>
      applyPublishedCalendarEvents(current, events)
    )
  }

  /**
   * A batch that failed part way still took effect: keep what went out and
   * refetch. Saving again publishes only what is still missing.
   */
  async function handleError(error: unknown) {
    if (error instanceof NostrCalendarPartialPublishError) {
      await applyPublished(error.published)
      void queryClient.invalidateQueries({ queryKey: dataKey })
    }
    reportError(error)
  }

  function publishAll(templates: NostrCalendarEventTemplate[]) {
    if (!nsec) {
      return Promise.reject(new Error(t('nostrIdentity.keys.watchOnly')))
    }
    return publishNostrCalendarTemplates(relays, nsec, templates)
  }

  function reportError(error: unknown) {
    const cause =
      error instanceof NostrCalendarPartialPublishError ? error.cause : error
    const message =
      cause instanceof NostrCalendarDraftInvalidError
        ? cause.message
        : getNostrErrorMessage(cause)
    toast.error(`${t('nostrIdentity.calendar.publishFailed')}: ${message}`)
  }

  /**
   * Publishes the event, then its calendar memberships. Switching all-day
   * changes the kind and so the address: the old address is moved out of
   * calendars and deleted last, so it doesn't stay live next to the new one.
   */
  const saveEvent = useMutation({
    mutationFn: async ({ draft, previous }: SaveEventInput) => {
      const template = templateOrThrow(buildCalendarEventTemplate(draft))
      const coordinate = getCalendarCoordinate(
        template.kind,
        ownPubkey,
        draft.dTag
      )
      const replaced =
        previous && previous.coordinate !== coordinate ? previous : undefined
      const membership = getMembershipTemplates(
        getData().calendars,
        coordinate,
        draft.calendarCoordinates,
        replaced?.coordinate
      )
      const published = await publishAll([
        template,
        ...membership,
        ...(replaced ? [buildCalendarDeletionTemplate(replaced)] : [])
      ])
      return {
        published: replaced ? published.slice(0, -1) : published,
        replaced
      }
    },
    onError: handleError,
    onSuccess: async ({ published, replaced }) => {
      await updateData((current) => {
        const applied = applyPublishedCalendarEvents(current, published)
        return replaced
          ? removeCalendarItem(applied, replaced.coordinate)
          : applied
      })
      toast.success(t('nostrIdentity.calendar.saved'))
    }
  })

  /**
   * Detaches the item from its calendars, then deletes it. If a detach
   * fails the item is still live and deleting again retries the rest.
   */
  const deleteItem = useMutation({
    mutationFn: async (item: CalendarItemRef) => {
      const detach = getData()
        .calendars.filter((calendar) =>
          calendar.eventCoordinates.includes(item.coordinate)
        )
        .flatMap((calendar) => {
          const result = toggleCalendarEvent(calendar, item.coordinate, false)
          return result.ok ? [result.template] : []
        })
      const published = await publishAll([
        ...detach,
        buildCalendarDeletionTemplate(item)
      ])
      return { item, published: published.slice(0, -1) }
    },
    onError: handleError,
    onSuccess: async ({ item, published }) => {
      await updateData((current) =>
        removeCalendarItem(
          applyPublishedCalendarEvents(current, published),
          item.coordinate
        )
      )
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
    onSuccess: async (published, input) => {
      await applyPublished([published])
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
    onError: handleError,
    onSuccess: async (published) => {
      await applyPublished(published)
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
    onError: handleError,
    onSuccess: async (published) => {
      await applyPublished(published)
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
