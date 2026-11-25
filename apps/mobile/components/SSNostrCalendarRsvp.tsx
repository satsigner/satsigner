import { StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  NOSTR_CALENDAR_FREE_BUSY,
  NOSTR_CALENDAR_RSVP_STATUSES
} from '@/constants/nostrCalendar'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type {
  NostrCalendarFreeBusy,
  NostrCalendarRsvpStatus,
  NostrCalendarRsvpSummary
} from '@/types/models/NostrCalendar'

type SSNostrCalendarRsvpProps = {
  canRespond: boolean
  freeBusy?: NostrCalendarFreeBusy
  note: string
  sending: boolean
  status?: NostrCalendarRsvpStatus
  /** Answer the user already published, if any. */
  sentStatus?: NostrCalendarRsvpStatus
  summary: NostrCalendarRsvpSummary
  onChangeFreeBusy: (value: NostrCalendarFreeBusy) => void
  onChangeNote: (note: string) => void
  onChangeStatus: (status: NostrCalendarRsvpStatus) => void
  onSubmit: () => void
}

type OptionProps<T extends string> = {
  active: boolean
  label: string
  value: T
  onSelect: (value: T) => void
}

function Option<T extends string>({
  active,
  label,
  value,
  onSelect
}: OptionProps<T>) {
  function handlePress() {
    onSelect(value)
  }

  return (
    <SSPressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[styles.option, active && styles.optionActive]}
      onPress={handlePress}
    >
      <SSText size="xs" center weight={active ? 'bold' : 'regular'}>
        {label}
      </SSText>
    </SSPressable>
  )
}

function SSNostrCalendarRsvp({
  canRespond,
  freeBusy,
  note,
  sending,
  status,
  sentStatus,
  summary,
  onChangeFreeBusy,
  onChangeNote,
  onChangeStatus,
  onSubmit
}: SSNostrCalendarRsvpProps) {
  return (
    <SSVStack gap="sm" style={styles.section}>
      <SSText size="xs" color="muted" uppercase>
        {t('nostrIdentity.calendar.rsvp.title')}
      </SSText>
      <SSHStack gap="md">
        {NOSTR_CALENDAR_RSVP_STATUSES.map((key) => (
          <SSText key={key} size="xs" color="muted">
            {t(`nostrIdentity.calendar.rsvp.count_${key}`, {
              count: summary[key]
            })}
          </SSText>
        ))}
      </SSHStack>
      {canRespond ? (
        <SSVStack gap="sm">
          <SSHStack gap="sm">
            {NOSTR_CALENDAR_RSVP_STATUSES.map((key) => (
              <Option
                key={key}
                active={status === key}
                label={t(`nostrIdentity.calendar.rsvp.${key}`)}
                value={key}
                onSelect={onChangeStatus}
              />
            ))}
          </SSHStack>
          {status && status !== 'declined' ? (
            <SSHStack gap="sm">
              {NOSTR_CALENDAR_FREE_BUSY.map((key) => (
                <Option
                  key={key}
                  active={freeBusy === key}
                  label={t(`nostrIdentity.calendar.rsvp.${key}`)}
                  value={key}
                  onSelect={onChangeFreeBusy}
                />
              ))}
            </SSHStack>
          ) : null}
          <SSTextInput
            align="left"
            size="small"
            value={note}
            placeholder={t('nostrIdentity.calendar.rsvp.notePlaceholder')}
            onChangeText={onChangeNote}
          />
          <SSButton
            label={
              sentStatus
                ? t('nostrIdentity.calendar.rsvp.update')
                : t('nostrIdentity.calendar.rsvp.send')
            }
            variant="secondary"
            disabled={!status || sending}
            loading={sending}
            onPress={onSubmit}
          />
        </SSVStack>
      ) : null}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  option: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8
  },
  optionActive: {
    borderColor: Colors.white
  },
  section: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 5,
    borderWidth: 1,
    padding: 12
  }
})

export default SSNostrCalendarRsvp
