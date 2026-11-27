import { Image, StyleSheet } from 'react-native'

import SSPressable from '@/components/SSPressable'
import SSTagChip from '@/components/SSTagChip'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { NostrCalendarEvent } from '@/types/models/NostrCalendar'

type ParticipantLabel = {
  label: string
  pubkey: string
  role?: string
}

type SSNostrCalendarEventDetailProps = {
  calendarTitles: string[]
  event: NostrCalendarEvent
  organizerLabel: string
  participants: ParticipantLabel[]
  when: { end?: string; start: string }
  timezoneLabel?: string
  onOpenLink: (url: string) => void
  onOpenParticipant: (pubkey: string) => void
}

const IMAGE_ASPECT_RATIO = 16 / 9

type FieldProps = {
  label: string
  children: React.ReactNode
}

function Field({ label, children }: FieldProps) {
  return (
    <SSVStack gap="xxs">
      <SSText size="xxs" color="muted" uppercase>
        {label}
      </SSText>
      {children}
    </SSVStack>
  )
}

type LinkProps = {
  url: string
  onOpen: (url: string) => void
}

function Link({ url, onOpen }: LinkProps) {
  function handlePress() {
    onOpen(url)
  }

  return (
    <SSPressable accessibilityRole="link" onPress={handlePress}>
      <SSText size="sm" style={styles.link} numberOfLines={1}>
        {url}
      </SSText>
    </SSPressable>
  )
}

type ParticipantProps = {
  participant: ParticipantLabel
  onOpen: (pubkey: string) => void
}

function Participant({ participant, onOpen }: ParticipantProps) {
  function handlePress() {
    onOpen(participant.pubkey)
  }

  return (
    <SSPressable accessibilityRole="button" onPress={handlePress}>
      <SSHStack gap="sm">
        <SSText size="sm" numberOfLines={1} style={styles.flex}>
          {participant.label}
        </SSText>
        {participant.role ? <SSTagChip tag={participant.role} /> : null}
      </SSHStack>
    </SSPressable>
  )
}

function SSNostrCalendarEventDetail({
  calendarTitles,
  event,
  organizerLabel,
  participants,
  when,
  timezoneLabel,
  onOpenLink,
  onOpenParticipant
}: SSNostrCalendarEventDetailProps) {
  return (
    <SSVStack gap="md">
      {event.image ? (
        <Image
          source={{ uri: event.image }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : null}
      <SSVStack gap="xs">
        <SSText size="2xl" weight="medium">
          {event.title || t('nostrIdentity.calendar.untitled')}
        </SSText>
        {event.summary ? (
          <SSText size="sm" color="muted">
            {event.summary}
          </SSText>
        ) : null}
      </SSVStack>
      <Field
        label={
          event.allDay
            ? t('nostrIdentity.calendar.allDay')
            : t('nostrIdentity.calendar.when')
        }
      >
        <SSText size="sm">{when.start}</SSText>
        {when.end ? <SSText size="sm">→ {when.end}</SSText> : null}
        {timezoneLabel ? (
          <SSText size="xs" color="muted">
            {timezoneLabel}
          </SSText>
        ) : null}
      </Field>
      {event.locations.length > 0 ? (
        <Field label={t('nostrIdentity.calendar.location')}>
          {event.locations.map((location) => (
            <SSText key={location} size="sm" selectable>
              {location}
            </SSText>
          ))}
        </Field>
      ) : null}
      {event.description ? (
        <Field label={t('nostrIdentity.calendar.description')}>
          <SSText size="sm" selectable>
            {event.description}
          </SSText>
        </Field>
      ) : null}
      <Field label={t('nostrIdentity.calendar.organizer')}>
        <SSText size="sm">{organizerLabel}</SSText>
      </Field>
      {participants.length > 0 ? (
        <Field label={t('nostrIdentity.calendar.participants')}>
          <SSVStack gap="xs">
            {participants.map((participant) => (
              <Participant
                key={participant.pubkey}
                participant={participant}
                onOpen={onOpenParticipant}
              />
            ))}
          </SSVStack>
        </Field>
      ) : null}
      {event.references.length > 0 ? (
        <Field label={t('nostrIdentity.calendar.links')}>
          {event.references.map((url) => (
            <Link key={url} url={url} onOpen={onOpenLink} />
          ))}
        </Field>
      ) : null}
      {event.hashtags.length > 0 ? (
        <SSHStack gap="xs" style={styles.wrap}>
          {event.hashtags.map((tag) => (
            <SSTagChip key={tag} tag={`#${tag}`} />
          ))}
        </SSHStack>
      ) : null}
      {calendarTitles.length > 0 ? (
        <Field label={t('nostrIdentity.calendar.calendars')}>
          <SSHStack gap="xs" style={styles.wrap}>
            {calendarTitles.map((title) => (
              <SSTagChip key={title} tag={title} />
            ))}
          </SSHStack>
        </Field>
      ) : null}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  image: {
    aspectRatio: IMAGE_ASPECT_RATIO,
    backgroundColor: Colors.gray[900],
    borderRadius: 5,
    width: '100%'
  },
  link: {
    color: Colors.mutedCyan,
    textDecorationLine: 'underline'
  },
  wrap: {
    flexWrap: 'wrap'
  }
})

export type { ParticipantLabel }
export default SSNostrCalendarEventDetail
