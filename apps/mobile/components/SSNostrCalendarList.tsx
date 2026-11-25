import { StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type {
  NostrCalendar,
  NostrCalendarEvent
} from '@/types/models/NostrCalendar'

type CalendarRequest = {
  calendar: NostrCalendar
  event: NostrCalendarEvent
  /** When the event happens, already formatted. */
  whenLabel: string
}

type SSNostrCalendarListProps = {
  calendars: NostrCalendar[]
  canWrite: boolean
  requests: CalendarRequest[]
  onAcceptRequest: (request: CalendarRequest) => void
  onEditCalendar: (calendar: NostrCalendar) => void
  onOpenEvent: (event: NostrCalendarEvent) => void
}

type CalendarRowProps = {
  calendar: NostrCalendar
  canWrite: boolean
  onEdit: (calendar: NostrCalendar) => void
}

function CalendarRow({ calendar, canWrite, onEdit }: CalendarRowProps) {
  function handlePress() {
    onEdit(calendar)
  }

  return (
    <SSPressable
      accessibilityRole="button"
      disabled={!canWrite}
      style={styles.card}
      onPress={handlePress}
    >
      <SSVStack gap="xxs">
        <SSHStack justifyBetween>
          <SSText size="md" weight="medium" style={styles.flex}>
            {calendar.title || t('nostrIdentity.calendar.untitled')}
          </SSText>
          <SSText size="xs" color="muted">
            {t('nostrIdentity.calendar.eventCount', {
              count: calendar.eventCoordinates.length
            })}
          </SSText>
        </SSHStack>
        {calendar.description ? (
          <SSText size="xs" color="muted" numberOfLines={2}>
            {calendar.description}
          </SSText>
        ) : null}
      </SSVStack>
    </SSPressable>
  )
}

type RequestRowProps = {
  canWrite: boolean
  request: CalendarRequest
  onAccept: (request: CalendarRequest) => void
  onOpen: (event: NostrCalendarEvent) => void
}

function RequestRow({ canWrite, request, onAccept, onOpen }: RequestRowProps) {
  function handleOpen() {
    onOpen(request.event)
  }

  function handleAccept() {
    onAccept(request)
  }

  return (
    <SSVStack gap="sm" style={styles.card}>
      <SSPressable accessibilityRole="button" onPress={handleOpen}>
        <SSVStack gap="xxs">
          <SSText size="sm" weight="medium">
            {request.event.title || t('nostrIdentity.calendar.untitled')}
          </SSText>
          <SSText size="xs" color="muted">
            {request.whenLabel}
          </SSText>
          <SSText size="xs" color="muted">
            {t('nostrIdentity.calendar.requestTo', {
              calendar: request.calendar.title
            })}
          </SSText>
        </SSVStack>
      </SSPressable>
      {canWrite ? (
        <SSButton
          label={t('nostrIdentity.calendar.acceptRequest')}
          variant="secondary"
          onPress={handleAccept}
        />
      ) : null}
    </SSVStack>
  )
}

function SSNostrCalendarList({
  calendars,
  canWrite,
  requests,
  onAcceptRequest,
  onEditCalendar,
  onOpenEvent
}: SSNostrCalendarListProps) {
  return (
    <SSVStack gap="lg">
      {requests.length > 0 ? (
        <SSVStack gap="sm">
          <SSText size="xs" color="muted" uppercase>
            {t('nostrIdentity.calendar.requests')}
          </SSText>
          {requests.map((request) => (
            <RequestRow
              key={`${request.calendar.coordinate}|${request.event.coordinate}`}
              canWrite={canWrite}
              request={request}
              onAccept={onAcceptRequest}
              onOpen={onOpenEvent}
            />
          ))}
        </SSVStack>
      ) : null}
      <SSVStack gap="sm">
        <SSText size="xs" color="muted" uppercase>
          {t('nostrIdentity.calendar.calendars')}
        </SSText>
        {calendars.length === 0 ? (
          <SSText size="sm" color="muted">
            {t('nostrIdentity.calendar.noCalendars')}
          </SSText>
        ) : (
          calendars.map((calendar) => (
            <CalendarRow
              key={calendar.coordinate}
              calendar={calendar}
              canWrite={canWrite}
              onEdit={onEditCalendar}
            />
          ))
        )}
      </SSVStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 5,
    borderWidth: 1,
    padding: 12
  },
  flex: {
    flex: 1
  }
})

export type { CalendarRequest }
export default SSNostrCalendarList
