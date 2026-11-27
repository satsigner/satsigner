import { StyleSheet, View } from 'react-native'

import SSPressable, { LIST_ITEM_PRESS_DELAY_MS } from '@/components/SSPressable'
import SSTagChip from '@/components/SSTagChip'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type {
  NostrCalendarEvent,
  NostrCalendarRsvpStatus
} from '@/types/models/NostrCalendar'

type SSNostrCalendarEventRowProps = {
  event: NostrCalendarEvent
  /** e.g. "09:00 – 10:00"; empty for all-day events. */
  timeLabel: string
  /** e.g. "Mon, Nov 24, 2026", shown when the row isn't under a day header. */
  dateLabel?: string
  invited?: boolean
  past?: boolean
  rsvpStatus?: NostrCalendarRsvpStatus
  onPress: (event: NostrCalendarEvent) => void
}

const RSVP_COLORS: Record<NostrCalendarRsvpStatus, string> = {
  accepted: Colors.mainGreen,
  declined: Colors.mainRed,
  tentative: Colors.warning
}

function SSNostrCalendarEventRow({
  event,
  timeLabel,
  dateLabel,
  invited = false,
  past = false,
  rsvpStatus,
  onPress
}: SSNostrCalendarEventRowProps) {
  function handlePress() {
    onPress(event)
  }

  const [location] = event.locations

  return (
    <SSPressable
      accessibilityRole="button"
      unstable_pressDelay={LIST_ITEM_PRESS_DELAY_MS}
      style={[styles.row, past && styles.past]}
      onPress={handlePress}
    >
      <View
        style={[
          styles.bar,
          rsvpStatus ? { backgroundColor: RSVP_COLORS[rsvpStatus] } : null
        ]}
      />
      <SSVStack gap="xxs" style={styles.body}>
        <SSHStack justifyBetween>
          <SSText size="xs" color="muted" uppercase>
            {timeLabel || t('nostrIdentity.calendar.allDay')}
          </SSText>
          {invited ? (
            <SSTagChip tag={t('nostrIdentity.calendar.invite')} />
          ) : null}
        </SSHStack>
        <SSText size="md" weight="medium" numberOfLines={2}>
          {event.title || t('nostrIdentity.calendar.untitled')}
        </SSText>
        {dateLabel ? (
          <SSText size="xs" color="muted">
            {dateLabel}
          </SSText>
        ) : null}
        {location ? (
          <SSText size="xs" color="muted" numberOfLines={1}>
            {location}
          </SSText>
        ) : null}
        {rsvpStatus ? (
          <SSText size="xxs" style={{ color: RSVP_COLORS[rsvpStatus] }}>
            {t(`nostrIdentity.calendar.rsvp.${rsvpStatus}`)}
          </SSText>
        ) : null}
      </SSVStack>
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.gray[600],
    borderRadius: 2,
    width: 3
  },
  body: {
    flex: 1
  },
  past: {
    opacity: 0.5
  },
  row: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 5,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12
  }
})

export default SSNostrCalendarEventRow
