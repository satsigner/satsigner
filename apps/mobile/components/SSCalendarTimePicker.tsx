import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import { SSIconTime } from '@/components/icons'
import SSModal from '@/components/SSModal'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Sizes } from '@/styles'
import {
  CALENDAR_HOUR_OPTIONS,
  CALENDAR_MINUTE_OPTIONS,
  formatTimeKey,
  parseTimeKey
} from '@/utils/nostrCalendar'

const ICON_SIZE = 16
const ROW_HEIGHT = 44
const VISIBLE_ROWS = 5
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS
const WHEEL_PADDING = (WHEEL_HEIGHT - ROW_HEIGHT) / 2
const WHEEL_WIDTH = 72

type SSCalendarTimePickerProps = {
  label: string
  /** HH:MM, or empty when not set. */
  value: string
  /** Time the picker opens on when there is no value, HH:MM. */
  defaultValue: string
  clearable?: boolean
  placeholder?: string
  onChange: (time: string) => void
}

type WheelProps = {
  accessibilityLabel: string
  options: string[]
  selected: number
  onSelect: (index: number) => void
}

function clampIndex(index: number, length: number) {
  return Math.min(Math.max(index, 0), length - 1)
}

type WheelRowProps = {
  index: number
  label: string
  selected: boolean
  onSelect: (index: number) => void
}

function WheelRow({ index, label, selected, onSelect }: WheelRowProps) {
  function handlePress() {
    onSelect(index)
  }

  return (
    <SSPressable style={styles.row} onPress={handlePress}>
      <SSText
        size="2xl"
        center
        weight={selected ? 'bold' : 'regular'}
        color={selected ? 'white' : 'muted'}
      >
        {label}
      </SSText>
    </SSPressable>
  )
}

/** A snapping column; the row in the middle band is the selected one. */
function Wheel({
  accessibilityLabel,
  options,
  selected,
  onSelect
}: WheelProps) {
  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT)
    onSelect(clampIndex(index, options.length))
  }

  return (
    <View style={styles.wheel}>
      <View pointerEvents="none" style={styles.band} />
      <ScrollView
        accessibilityLabel={accessibilityLabel}
        contentOffset={{ x: 0, y: selected * ROW_HEIGHT }}
        contentContainerStyle={styles.wheelContent}
        decelerationRate="fast"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {options.map((option, index) => (
          <WheelRow
            key={option}
            index={index}
            label={option}
            selected={index === selected}
            onSelect={onSelect}
          />
        ))}
      </ScrollView>
    </View>
  )
}

/** A field that opens hour and minute wheels to pick a time of day. */
function SSCalendarTimePicker({
  label,
  value,
  defaultValue,
  clearable = false,
  placeholder,
  onChange
}: SSCalendarTimePickerProps) {
  const [open, setOpen] = useState(false)
  const initial = parseTimeKey(value) ??
    parseTimeKey(defaultValue) ?? { hours: 0, minutes: 0 }
  const [hours, setHours] = useState(initial.hours)
  const [minutes, setMinutes] = useState(initial.minutes)
  const hasValue = parseTimeKey(value) !== null

  function handleOpen() {
    setHours(initial.hours)
    setMinutes(initial.minutes)
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
  }

  function handleConfirm() {
    onChange(formatTimeKey(hours, minutes))
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    setOpen(false)
  }

  return (
    <SSVStack gap="xxs" style={styles.field}>
      <SSText size="xxs" color="muted" uppercase>
        {label}
      </SSText>
      <SSPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: hasValue ? value : (placeholder ?? '') }}
        style={styles.input}
        onPress={handleOpen}
      >
        <SSHStack justifyBetween>
          <SSText size="sm" color={hasValue ? 'white' : 'muted'}>
            {hasValue
              ? value
              : (placeholder ?? t('nostrIdentity.calendar.pickTime'))}
          </SSText>
          <SSIconTime width={ICON_SIZE} height={ICON_SIZE} />
        </SSHStack>
      </SSPressable>
      <SSModal
        visible={open}
        title={label}
        confirmLabel={t('common.confirm')}
        onConfirm={handleConfirm}
        onClose={handleClose}
      >
        <SSVStack gap="md" itemsCenter>
          {open ? (
            <SSHStack gap="sm">
              <Wheel
                accessibilityLabel={t('nostrIdentity.calendar.hours')}
                options={CALENDAR_HOUR_OPTIONS}
                selected={hours}
                onSelect={setHours}
              />
              <SSText size="2xl">:</SSText>
              <Wheel
                accessibilityLabel={t('nostrIdentity.calendar.minutes')}
                options={CALENDAR_MINUTE_OPTIONS}
                selected={minutes}
                onSelect={setMinutes}
              />
            </SSHStack>
          ) : null}
          {clearable && hasValue ? (
            <SSPressable accessibilityRole="button" onPress={handleClear}>
              <SSText size="xs" color="muted" uppercase>
                {t('common.clear')}
              </SSText>
            </SSPressable>
          ) : null}
        </SSVStack>
      </SSModal>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  band: {
    borderColor: Colors.gray[600],
    borderRadius: 6,
    borderWidth: 1,
    height: ROW_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: WHEEL_PADDING
  },
  field: {
    flex: 1
  },
  input: {
    backgroundColor: Colors.gray[850],
    borderRadius: Sizes.textInput.borderRadius,
    height: Sizes.textInput.height.small,
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  row: {
    height: ROW_HEIGHT,
    justifyContent: 'center'
  },
  wheel: {
    height: WHEEL_HEIGHT,
    width: WHEEL_WIDTH
  },
  wheelContent: {
    paddingVertical: WHEEL_PADDING
  }
})

export default SSCalendarTimePicker
