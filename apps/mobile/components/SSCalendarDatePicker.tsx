import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { SSIconCalendar } from '@/components/icons'
import SSModal from '@/components/SSModal'
import SSNostrCalendarMonth from '@/components/SSNostrCalendarMonth'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Sizes } from '@/styles'
import {
  buildMonthGrid,
  formatDateKeyLabel,
  formatMonthTitle,
  getMonthOfDateKey,
  getPickerMonth,
  shiftMonth
} from '@/utils/nostrCalendar'

const ICON_SIZE = 16
const NO_COUNTS = new Map<string, number>()

type SSCalendarDatePickerProps = {
  label: string
  /** YYYY-MM-DD, or empty when not set. */
  value: string
  /** Day the picker opens on when there is no value, YYYY-MM-DD. */
  todayKey: string
  /** Shows a clear action, for optional dates. */
  clearable?: boolean
  placeholder?: string
  onChange: (dateKey: string) => void
}

/** A field that opens a month grid to pick a day. */
function SSCalendarDatePicker({
  label,
  value,
  todayKey,
  clearable = false,
  placeholder,
  onChange
}: SSCalendarDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => getPickerMonth(value, todayKey))
  const valueLabel = formatDateKeyLabel(value)

  function handleOpen() {
    setMonth(getPickerMonth(value, todayKey))
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
  }

  function handleSelect(dateKey: string) {
    onChange(dateKey)
    setMonth(getMonthOfDateKey(dateKey))
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    setOpen(false)
  }

  function handlePreviousMonth() {
    setMonth((current) => shiftMonth(current, -1))
  }

  function handleNextMonth() {
    setMonth((current) => shiftMonth(current, 1))
  }

  return (
    <SSVStack gap="xxs" style={styles.field}>
      <SSText size="xxs" color="muted" uppercase>
        {label}
      </SSText>
      <SSPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: valueLabel ?? placeholder ?? '' }}
        style={styles.input}
        onPress={handleOpen}
      >
        <SSHStack justifyBetween>
          <SSText
            size="sm"
            color={valueLabel ? 'white' : 'muted'}
            numberOfLines={1}
            style={styles.flex}
          >
            {valueLabel ?? placeholder ?? t('nostrIdentity.calendar.pickDate')}
          </SSText>
          <SSIconCalendar
            width={ICON_SIZE}
            height={ICON_SIZE}
            color={Colors.gray[200]}
          />
        </SSHStack>
      </SSPressable>
      <SSModal visible={open} title={label} onClose={handleClose}>
        <View style={styles.modalContent}>
          <SSNostrCalendarMonth
            days={buildMonthGrid(month)}
            eventCounts={NO_COUNTS}
            selectedKey={value}
            title={formatMonthTitle(month)}
            todayKey={todayKey}
            onNextMonth={handleNextMonth}
            onPreviousMonth={handlePreviousMonth}
            onSelectDay={handleSelect}
          />
          {clearable && value ? (
            <SSPressable
              accessibilityRole="button"
              style={styles.clear}
              onPress={handleClear}
            >
              <SSText size="xs" color="muted" uppercase center>
                {t('common.clear')}
              </SSText>
            </SSPressable>
          ) : null}
        </View>
      </SSModal>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  clear: {
    paddingVertical: 12
  },
  field: {
    flex: 1
  },
  flex: {
    flex: 1
  },
  input: {
    backgroundColor: Colors.gray[850],
    borderRadius: Sizes.textInput.borderRadius,
    height: Sizes.textInput.height.small,
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  modalContent: {
    width: '100%'
  }
})

export default SSCalendarDatePicker
