import { StyleSheet } from 'react-native'

import SSCalendarDatePicker from '@/components/SSCalendarDatePicker'
import SSCalendarTimePicker from '@/components/SSCalendarTimePicker'
import SSCheckbox from '@/components/SSCheckbox'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  NOSTR_CALENDAR_DEFAULT_END_TIME,
  NOSTR_CALENDAR_DEFAULT_START_TIME,
  NOSTR_CALENDAR_TITLE_MAX_LENGTH
} from '@/constants/nostrCalendar'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type {
  NostrCalendar,
  NostrCalendarEventDraft
} from '@/types/models/NostrCalendar'

type DraftField = keyof NostrCalendarEventDraft

type SSNostrCalendarEventFormProps = {
  calendars: NostrCalendar[]
  draft: NostrCalendarEventDraft
  error?: string
  /** Day the date pickers open on when empty, YYYY-MM-DD. */
  todayKey: string
  onChange: (changes: Partial<NostrCalendarEventDraft>) => void
}

const MULTILINE_HEIGHT = 96

type FieldProps = {
  field: DraftField
  label: string
  value: string
  placeholder?: string
  multiline?: boolean
  maxLength?: number
  keyboardType?: 'default' | 'url'
  onChange: (changes: Partial<NostrCalendarEventDraft>) => void
}

function Field({
  field,
  label,
  value,
  placeholder,
  multiline = false,
  maxLength,
  keyboardType = 'default',
  onChange
}: FieldProps) {
  function handleChange(text: string) {
    onChange({ [field]: text })
  }

  return (
    <SSVStack gap="xxs" style={styles.field}>
      <SSText size="xxs" color="muted" uppercase>
        {label}
      </SSText>
      <SSTextInput
        align="left"
        size="small"
        value={value}
        placeholder={placeholder}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'default' ? 'sentences' : 'none'}
        style={multiline ? styles.multiline : undefined}
        textAlignVertical={multiline ? 'top' : 'center'}
        onChangeText={handleChange}
      />
    </SSVStack>
  )
}

type CalendarToggleProps = {
  calendar: NostrCalendar
  selected: boolean
  onToggle: (coordinate: string) => void
}

function CalendarToggle({ calendar, selected, onToggle }: CalendarToggleProps) {
  function handlePress() {
    onToggle(calendar.coordinate)
  }

  return (
    <SSPressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={[styles.chip, selected && styles.chipActive]}
      onPress={handlePress}
    >
      <SSText size="xs" color={selected ? 'white' : 'muted'}>
        {calendar.title || t('nostrIdentity.calendar.untitled')}
      </SSText>
    </SSPressable>
  )
}

function SSNostrCalendarEventForm({
  calendars,
  draft,
  error,
  todayKey,
  onChange
}: SSNostrCalendarEventFormProps) {
  function handleStartDate(startDate: string) {
    onChange({ startDate })
  }

  function handleEndDate(endDate: string) {
    onChange({ endDate })
  }

  function handleStartTime(startTime: string) {
    onChange({ startTime })
  }

  function handleEndTime(endTime: string) {
    onChange({ endTime })
  }

  function handleAllDayToggle(selected: boolean) {
    onChange({ allDay: !selected })
  }

  function handleCalendarToggle(coordinate: string) {
    const selected = draft.calendarCoordinates.includes(coordinate)
    onChange({
      calendarCoordinates: selected
        ? draft.calendarCoordinates.filter((item) => item !== coordinate)
        : [...draft.calendarCoordinates, coordinate]
    })
  }

  return (
    <SSVStack gap="md">
      <Field
        field="title"
        label={t('nostrIdentity.calendar.form.title')}
        value={draft.title}
        maxLength={NOSTR_CALENDAR_TITLE_MAX_LENGTH}
        onChange={onChange}
      />
      <SSCheckbox
        label={t('nostrIdentity.calendar.allDay')}
        description={t('nostrIdentity.calendar.form.allDayHint')}
        selected={draft.allDay}
        labelProps={{ size: 'sm' }}
        onPress={handleAllDayToggle}
      />
      <SSHStack gap="sm" style={styles.row}>
        <SSCalendarDatePicker
          label={t('nostrIdentity.calendar.form.startDate')}
          value={draft.startDate}
          todayKey={todayKey}
          onChange={handleStartDate}
        />
        {draft.allDay ? null : (
          <SSCalendarTimePicker
            label={t('nostrIdentity.calendar.form.startTime')}
            value={draft.startTime}
            defaultValue={NOSTR_CALENDAR_DEFAULT_START_TIME}
            onChange={handleStartTime}
          />
        )}
      </SSHStack>
      <SSHStack gap="sm" style={styles.row}>
        <SSCalendarDatePicker
          label={
            draft.allDay
              ? t('nostrIdentity.calendar.form.lastDay')
              : t('nostrIdentity.calendar.form.endDate')
          }
          value={draft.endDate}
          todayKey={draft.startDate || todayKey}
          clearable
          placeholder={t('nostrIdentity.calendar.form.sameDay')}
          onChange={handleEndDate}
        />
        {draft.allDay ? null : (
          <SSCalendarTimePicker
            label={t('nostrIdentity.calendar.form.endTime')}
            value={draft.endTime}
            defaultValue={draft.startTime || NOSTR_CALENDAR_DEFAULT_END_TIME}
            clearable
            placeholder={t('nostrIdentity.calendar.form.noEnd')}
            onChange={handleEndTime}
          />
        )}
      </SSHStack>
      {draft.allDay ? null : (
        <Field
          field="timezone"
          label={t('nostrIdentity.calendar.form.timezone')}
          value={draft.timezone}
          keyboardType="url"
          onChange={onChange}
        />
      )}
      <Field
        field="summary"
        label={t('nostrIdentity.calendar.form.summary')}
        value={draft.summary}
        onChange={onChange}
      />
      <Field
        field="description"
        label={t('nostrIdentity.calendar.description')}
        value={draft.description}
        multiline
        onChange={onChange}
      />
      <Field
        field="locations"
        label={t('nostrIdentity.calendar.form.locations')}
        value={draft.locations}
        placeholder={t('nostrIdentity.calendar.form.onePerLine')}
        multiline
        onChange={onChange}
      />
      <Field
        field="participants"
        label={t('nostrIdentity.calendar.participants')}
        value={draft.participants}
        placeholder={t('nostrIdentity.calendar.form.participantsHint')}
        keyboardType="url"
        multiline
        onChange={onChange}
      />
      <Field
        field="hashtags"
        label={t('nostrIdentity.calendar.form.hashtags')}
        value={draft.hashtags}
        placeholder={t('nostrIdentity.calendar.form.hashtagsHint')}
        keyboardType="url"
        onChange={onChange}
      />
      <Field
        field="references"
        label={t('nostrIdentity.calendar.links')}
        value={draft.references}
        placeholder={t('nostrIdentity.calendar.form.onePerLine')}
        keyboardType="url"
        multiline
        onChange={onChange}
      />
      <Field
        field="image"
        label={t('nostrIdentity.calendar.form.image')}
        value={draft.image}
        placeholder="https://"
        keyboardType="url"
        onChange={onChange}
      />
      {calendars.length > 0 ? (
        <SSVStack gap="xs">
          <SSText size="xxs" color="muted" uppercase>
            {t('nostrIdentity.calendar.calendars')}
          </SSText>
          <SSHStack gap="xs" style={styles.wrap}>
            {calendars.map((calendar) => (
              <CalendarToggle
                key={calendar.coordinate}
                calendar={calendar}
                selected={draft.calendarCoordinates.includes(
                  calendar.coordinate
                )}
                onToggle={handleCalendarToggle}
              />
            ))}
          </SSHStack>
        </SSVStack>
      ) : null}
      {error ? (
        <SSText size="sm" style={styles.error}>
          {error}
        </SSText>
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
    paddingVertical: 6
  },
  chipActive: {
    backgroundColor: Colors.gray[700]
  },
  error: {
    color: Colors.error
  },
  field: {
    flex: 1
  },
  multiline: {
    height: MULTILINE_HEIGHT,
    paddingVertical: 8
  },
  row: {
    alignItems: 'flex-start'
  },
  wrap: {
    flexWrap: 'wrap'
  }
})

export default SSNostrCalendarEventForm
