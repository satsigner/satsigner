import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import SSDesignSection from '@/components/SSDesignSection'
import SSNostrCalendarEventDetail from '@/components/SSNostrCalendarEventDetail'
import SSNostrCalendarEventForm from '@/components/SSNostrCalendarEventForm'
import SSNostrCalendarEventRow from '@/components/SSNostrCalendarEventRow'
import type { CalendarRequest } from '@/components/SSNostrCalendarList'
import SSNostrCalendarList from '@/components/SSNostrCalendarList'
import SSNostrCalendarRsvp from '@/components/SSNostrCalendarRsvp'
import SSNostrCalendarView from '@/components/SSNostrCalendarView'
import SSSeparator from '@/components/SSSeparator'
import { DESIGN_NOSTR_CALENDAR_SETS } from '@/constants/designNostrCalendarSamples'
import { useNostrCalendarView } from '@/hooks/useNostrCalendarView'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import type {
  NostrCalendarEventDraft,
  NostrCalendarFreeBusy,
  NostrCalendarRsvpStatus
} from '@/types/models/NostrCalendar'
import { formatNpub } from '@/utils/format'
import { safeNpubEncode } from '@/utils/nostr'
import {
  draftFromCalendarEvent,
  formatCalendarEventTime,
  formatCalendarEventWhen
} from '@/utils/nostrCalendar'

const tn = _tn('settings.developer.designSystem.features')

const PREVIEW_TIMEZONE = 'Europe/Lisbon'

type SetPreviewProps = {
  setIndex: number
}

function NOOP() {
  // design preview only
}

function labelOf(pubkey: string) {
  return formatNpub(safeNpubEncode(pubkey))
}

function NostrCalendarPreview({ setIndex }: SetPreviewProps) {
  const sample = DESIGN_NOSTR_CALENDAR_SETS[setIndex].data
  const { data, detail, ownPubkey, summary } = sample
  const view = useNostrCalendarView(data, ownPubkey)
  const [status, setStatus] = useState<NostrCalendarRsvpStatus>()
  const [freeBusy, setFreeBusy] = useState<NostrCalendarFreeBusy>()
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState(() =>
    draftFromCalendarEvent(detail, PREVIEW_TIMEZONE)
  )

  function handleDraftChange(changes: Partial<NostrCalendarEventDraft>) {
    setDraft((current) => ({ ...current, ...changes }))
  }

  const requests: CalendarRequest[] = data.requests.flatMap((event) =>
    data.calendars
      .filter((calendar) =>
        event.calendarCoordinates.includes(calendar.coordinate)
      )
      .map((calendar) => ({
        calendar,
        event,
        whenLabel: formatCalendarEventWhen(event, PREVIEW_TIMEZONE).start
      }))
  )
  const [firstEvent] = data.events
  const [firstInvite] = data.invites

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        <SSDesignSection title={tn('nostrCalendarView')}>
          <SSNostrCalendarView
            agendaPastRows={view.agendaPastRows}
            agendaUpcomingRows={view.agendaUpcomingRows}
            calendarFilter={view.calendarFilter}
            calendars={data.calendars}
            dayRows={view.dayRows}
            dayTitle={view.dayTitle}
            eventCounts={view.eventCounts}
            gridDays={view.gridDays}
            mode={view.mode}
            monthTitle={view.monthTitle}
            selectedKey={view.selectedKey}
            todayKey={view.todayKey}
            onChangeFilter={view.setCalendarFilter}
            onChangeMode={view.setMode}
            onNextMonth={view.handleNextMonth}
            onOpenEvent={NOOP}
            onPreviousMonth={view.handlePreviousMonth}
            onSelectDay={view.handleSelectDay}
            onToday={view.handleToday}
          />
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('nostrCalendarRows')}>
          <SSVStack gap="sm">
            {firstEvent ? (
              <SSNostrCalendarEventRow
                event={firstEvent}
                timeLabel={formatCalendarEventTime(
                  firstEvent,
                  PREVIEW_TIMEZONE
                )}
                dateLabel={
                  formatCalendarEventWhen(firstEvent, PREVIEW_TIMEZONE).start
                }
                past
                onPress={NOOP}
              />
            ) : null}
            {firstInvite ? (
              <SSNostrCalendarEventRow
                event={firstInvite}
                timeLabel={formatCalendarEventTime(
                  firstInvite,
                  PREVIEW_TIMEZONE
                )}
                invited
                rsvpStatus="accepted"
                onPress={NOOP}
              />
            ) : null}
            <SSNostrCalendarEventRow
              event={detail}
              timeLabel={formatCalendarEventTime(detail, PREVIEW_TIMEZONE)}
              rsvpStatus="tentative"
              onPress={NOOP}
            />
          </SSVStack>
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('nostrCalendarDetail')}>
          <SSNostrCalendarEventDetail
            calendarTitles={data.calendars.map((calendar) => calendar.title)}
            event={detail}
            organizerLabel={labelOf(detail.pubkey)}
            participants={detail.participants.map((participant) => ({
              label: labelOf(participant.pubkey),
              pubkey: participant.pubkey,
              ...(participant.role ? { role: participant.role } : {})
            }))}
            timezoneLabel={detail.allDay ? undefined : PREVIEW_TIMEZONE}
            when={formatCalendarEventWhen(detail, PREVIEW_TIMEZONE)}
            onOpenLink={NOOP}
            onOpenParticipant={NOOP}
          />
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('nostrCalendarRsvp')}>
          <SSNostrCalendarRsvp
            canRespond
            freeBusy={freeBusy}
            note={note}
            sending={false}
            status={status}
            summary={summary}
            onChangeFreeBusy={setFreeBusy}
            onChangeNote={setNote}
            onChangeStatus={setStatus}
            onSubmit={NOOP}
          />
          <SSNostrCalendarRsvp
            canRespond={false}
            note=""
            sending={false}
            summary={summary}
            onChangeFreeBusy={NOOP}
            onChangeNote={NOOP}
            onChangeStatus={NOOP}
            onSubmit={NOOP}
          />
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('nostrCalendarList')}>
          <SSNostrCalendarList
            calendars={data.calendars}
            canWrite
            requests={requests}
            onAcceptRequest={NOOP}
            onEditCalendar={NOOP}
            onOpenEvent={NOOP}
          />
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('nostrCalendarForm')}>
          <View>
            <SSNostrCalendarEventForm
              calendars={data.calendars}
              draft={draft}
              onChange={handleDraftChange}
            />
          </View>
        </SSDesignSection>
      </SSVStack>
    </SSScrollView>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 64
  }
})

export { NostrCalendarPreview }
