import { ScrollView, StyleSheet } from 'react-native'

import SSNostrCalendarEventRow from '@/components/SSNostrCalendarEventRow'
import SSNostrCalendarMonth from '@/components/SSNostrCalendarMonth'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import type {
  CalendarRowItem,
  NostrCalendarViewMode
} from '@/hooks/useNostrCalendarView'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type {
  NostrCalendar,
  NostrCalendarEvent,
  NostrCalendarGridDay
} from '@/types/models/NostrCalendar'

type SSNostrCalendarViewProps = {
  agendaPastRows: CalendarRowItem[]
  agendaUpcomingRows: CalendarRowItem[]
  calendarFilter?: string
  calendars: NostrCalendar[]
  dayRows: CalendarRowItem[]
  dayTitle: string
  eventCounts: Map<string, number>
  gridDays: NostrCalendarGridDay[]
  mode: NostrCalendarViewMode
  monthTitle: string
  selectedKey: string
  todayKey: string
  onChangeFilter: (coordinate: string | undefined) => void
  onChangeMode: (mode: NostrCalendarViewMode) => void
  onNextMonth: () => void
  onOpenEvent: (event: NostrCalendarEvent) => void
  onPreviousMonth: () => void
  onSelectDay: (dateKey: string) => void
  onToday: () => void
}

type FilterChipProps = {
  active: boolean
  coordinate?: string
  label: string
  onSelect: (coordinate: string | undefined) => void
}

function FilterChip({ active, coordinate, label, onSelect }: FilterChipProps) {
  function handlePress() {
    onSelect(coordinate)
  }

  return (
    <SSPressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
      onPress={handlePress}
    >
      <SSText size="xs" uppercase color={active ? 'white' : 'muted'}>
        {label}
      </SSText>
    </SSPressable>
  )
}

type RowListProps = {
  rows: CalendarRowItem[]
  onOpen: (event: NostrCalendarEvent) => void
}

function RowList({ rows, onOpen }: RowListProps) {
  return (
    <SSVStack gap="sm">
      {rows.map((row) => (
        <SSNostrCalendarEventRow
          key={row.event.coordinate}
          dateLabel={row.dateLabel}
          event={row.event}
          invited={row.invited}
          past={row.past}
          rsvpStatus={row.rsvpStatus}
          timeLabel={row.timeLabel}
          onPress={onOpen}
        />
      ))}
    </SSVStack>
  )
}

function SSNostrCalendarView({
  agendaPastRows,
  agendaUpcomingRows,
  calendarFilter,
  calendars,
  dayRows,
  dayTitle,
  eventCounts,
  gridDays,
  mode,
  monthTitle,
  selectedKey,
  todayKey,
  onChangeFilter,
  onChangeMode,
  onNextMonth,
  onOpenEvent,
  onPreviousMonth,
  onSelectDay,
  onToday
}: SSNostrCalendarViewProps) {
  const noAgenda =
    agendaUpcomingRows.length === 0 && agendaPastRows.length === 0

  return (
    <SSVStack gap="md">
      <SSPairedTabs
        activeTab={mode}
        primary={{ key: 'month', label: t('nostrIdentity.calendar.month') }}
        secondary={{ key: 'agenda', label: t('nostrIdentity.calendar.agenda') }}
        onChange={onChangeMode}
      />
      {calendars.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <FilterChip
            active={calendarFilter === undefined}
            label={t('nostrIdentity.calendar.allCalendars')}
            onSelect={onChangeFilter}
          />
          {calendars.map((calendar) => (
            <FilterChip
              key={calendar.coordinate}
              active={calendarFilter === calendar.coordinate}
              coordinate={calendar.coordinate}
              label={calendar.title || t('nostrIdentity.calendar.untitled')}
              onSelect={onChangeFilter}
            />
          ))}
        </ScrollView>
      ) : null}
      {mode === 'month' ? (
        <SSVStack gap="md">
          <SSNostrCalendarMonth
            days={gridDays}
            eventCounts={eventCounts}
            selectedKey={selectedKey}
            title={monthTitle}
            todayKey={todayKey}
            onNextMonth={onNextMonth}
            onPreviousMonth={onPreviousMonth}
            onSelectDay={onSelectDay}
          />
          <SSHStack justifyBetween>
            <SSText size="sm" weight="medium">
              {dayTitle}
            </SSText>
            {selectedKey === todayKey ? null : (
              <SSPressable accessibilityRole="button" onPress={onToday}>
                <SSText size="xs" color="muted" uppercase>
                  {t('date.today')}
                </SSText>
              </SSPressable>
            )}
          </SSHStack>
          {dayRows.length === 0 ? (
            <SSText size="sm" color="muted">
              {t('nostrIdentity.calendar.noEventsDay')}
            </SSText>
          ) : (
            <RowList rows={dayRows} onOpen={onOpenEvent} />
          )}
        </SSVStack>
      ) : null}
      {mode === 'agenda' && noAgenda ? (
        <SSText size="sm" color="muted" center>
          {t('nostrIdentity.calendar.empty')}
        </SSText>
      ) : null}
      {mode === 'agenda' && agendaUpcomingRows.length > 0 ? (
        <SSVStack gap="sm">
          <SSText size="xs" color="muted" uppercase>
            {t('nostrIdentity.calendar.upcoming')}
          </SSText>
          <RowList rows={agendaUpcomingRows} onOpen={onOpenEvent} />
        </SSVStack>
      ) : null}
      {mode === 'agenda' && agendaPastRows.length > 0 ? (
        <SSVStack gap="sm">
          <SSText size="xs" color="muted" uppercase>
            {t('nostrIdentity.calendar.past')}
          </SSText>
          <RowList rows={agendaPastRows} onOpen={onOpenEvent} />
        </SSVStack>
      ) : null}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderColor: Colors.gray[700],
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  chipActive: {
    backgroundColor: Colors.gray[700]
  },
  chips: {
    gap: 8
  }
})

export default SSNostrCalendarView
