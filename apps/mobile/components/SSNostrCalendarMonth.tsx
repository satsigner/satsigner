import { StyleSheet, View } from 'react-native'

import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSIconButton from '@/components/SSIconButton'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import { NOSTR_CALENDAR_WEEK_STARTS_ON } from '@/constants/nostrCalendar'
import { DAYS_PER_WEEK } from '@/constants/time'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { NostrCalendarGridDay } from '@/types/models/NostrCalendar'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const WEEKDAY_KEYS = Array.from(
  { length: DAYS_PER_WEEK },
  (_, index) =>
    DAY_KEYS[(index + NOSTR_CALENDAR_WEEK_STARTS_ON) % DAYS_PER_WEEK]
)
const CHEVRON_WIDTH = 7
const CHEVRON_HEIGHT = 14
const MAX_DOTS = 3
const CELL_WIDTH = `${100 / DAYS_PER_WEEK}%` as const

type SSNostrCalendarMonthProps = {
  days: NostrCalendarGridDay[]
  /** Number of events per day key. */
  eventCounts: Map<string, number>
  selectedKey: string
  title: string
  todayKey: string
  onNextMonth: () => void
  onPreviousMonth: () => void
  onSelectDay: (dateKey: string) => void
}

type DayCellProps = {
  count: number
  day: NostrCalendarGridDay
  selected: boolean
  today: boolean
  onSelect: (dateKey: string) => void
}

function DayCell({ count, day, selected, today, onSelect }: DayCellProps) {
  function handlePress() {
    onSelect(day.dateKey)
  }

  return (
    <SSPressable
      accessibilityLabel={day.dateKey}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={styles.cell}
      onPress={handlePress}
    >
      <View
        style={[
          styles.dayCircle,
          today && styles.today,
          selected && styles.selected
        ]}
      >
        <SSText
          size="sm"
          weight={selected || today ? 'bold' : 'regular'}
          style={[
            !day.inMonth && styles.outside,
            selected && styles.selectedText
          ]}
        >
          {day.day}
        </SSText>
      </View>
      <SSHStack gap="none" style={styles.dots}>
        {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, index) => (
          <View key={index} style={styles.dot} />
        ))}
      </SSHStack>
    </SSPressable>
  )
}

function SSNostrCalendarMonth({
  days,
  eventCounts,
  selectedKey,
  title,
  todayKey,
  onNextMonth,
  onPreviousMonth,
  onSelectDay
}: SSNostrCalendarMonthProps) {
  return (
    <SSVStack gap="sm">
      <SSHStack justifyBetween>
        <SSIconButton
          accessibilityLabel={t('nostrIdentity.calendar.previousMonth')}
          style={styles.navButton}
          onPress={onPreviousMonth}
        >
          <SSIconChevronLeft
            width={CHEVRON_WIDTH}
            height={CHEVRON_HEIGHT}
            stroke={Colors.gray[100]}
          />
        </SSIconButton>
        <SSText uppercase weight="medium">
          {title}
        </SSText>
        <SSIconButton
          accessibilityLabel={t('nostrIdentity.calendar.nextMonth')}
          style={styles.navButton}
          onPress={onNextMonth}
        >
          <SSIconChevronRight width={CHEVRON_WIDTH} height={CHEVRON_HEIGHT} />
        </SSIconButton>
      </SSHStack>
      <View style={styles.grid}>
        {WEEKDAY_KEYS.map((key) => (
          <View key={key} style={styles.weekday}>
            <SSText size="xxs" color="muted" uppercase center>
              {t(`date.${key}`)}
            </SSText>
          </View>
        ))}
        {days.map((day) => (
          <DayCell
            key={day.dateKey}
            count={eventCounts.get(day.dateKey) ?? 0}
            day={day}
            selected={day.dateKey === selectedKey}
            today={day.dateKey === todayKey}
            onSelect={onSelectDay}
          />
        ))}
      </View>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    paddingVertical: 4,
    width: CELL_WIDTH
  },
  dayCircle: {
    alignItems: 'center',
    borderColor: Colors.transparent,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  dot: {
    backgroundColor: Colors.mainGreen,
    borderRadius: 2,
    height: 4,
    marginHorizontal: 1,
    width: 4
  },
  dots: {
    height: 6,
    justifyContent: 'center'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  navButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  outside: {
    color: Colors.gray[600]
  },
  selected: {
    backgroundColor: Colors.white,
    borderColor: Colors.white
  },
  selectedText: {
    color: Colors.black
  },
  today: {
    borderColor: Colors.gray[400]
  },
  weekday: {
    paddingBottom: 4,
    width: CELL_WIDTH
  }
})

export default SSNostrCalendarMonth
