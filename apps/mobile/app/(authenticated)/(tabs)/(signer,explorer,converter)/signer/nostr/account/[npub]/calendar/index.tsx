import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, RefreshControl, StyleSheet } from 'react-native'

import { SSIconPlus, SSIconList } from '@/components/icons'
import SSIconButton from '@/components/SSIconButton'
import SSNostrCalendarView from '@/components/SSNostrCalendarView'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_INLINE_ICON_SIZE
} from '@/constants/headerChrome'
import { useNostrCalendarFetch } from '@/hooks/useNostrCalendarFetch'
import { useNostrCalendarView } from '@/hooks/useNostrCalendarView'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { NostrCalendarEvent } from '@/types/models/NostrCalendar'
import {
  nostrCalendarEditHref,
  nostrCalendarEventHref,
  nostrCalendarsHref
} from '@/utils/nostrNavigation'

type CalendarParams = {
  npub: string
}

function getStatusMessage({
  isError,
  relayConnected,
  relaysAvailable
}: {
  isError: boolean
  relayConnected: boolean
  relaysAvailable: boolean
}): string | undefined {
  if (!relayConnected) {
    return t('nostrIdentity.account.relayDisconnected')
  }
  if (!relaysAvailable) {
    return t('nostrIdentity.account.relayNoRelays')
  }
  if (isError) {
    return t('nostrIdentity.account.relayAllFailed')
  }
  return undefined
}

export default function NostrCalendarScreen() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<CalendarParams>()
  const calendar = useNostrCalendarFetch(npub)
  const view = useNostrCalendarView(calendar.data, calendar.ownPubkey)

  const statusMessage = getStatusMessage({
    isError: calendar.isError,
    relayConnected: calendar.relayConnected,
    relaysAvailable: calendar.relays.length > 0
  })
  const pendingRequests = calendar.data.requests.length

  function handleOpenEvent(event: NostrCalendarEvent) {
    router.navigate(nostrCalendarEventHref(npub, event.coordinate))
  }

  function handleCreate() {
    router.navigate(nostrCalendarEditHref(npub, { date: view.selectedKey }))
  }

  function handleOpenCalendars() {
    router.navigate(nostrCalendarsHref(npub))
  }

  function handleRefresh() {
    void calendar.refetch()
  }

  function renderHeaderRight() {
    return (
      <SSHStack gap="none" style={styles.header}>
        <SSIconButton
          accessibilityLabel={t('nostrIdentity.calendar.calendars')}
          style={HEADER_CHROME_HIT_BOX}
          onPress={handleOpenCalendars}
        >
          <SSIconList
            height={HEADER_INLINE_ICON_SIZE}
            width={HEADER_INLINE_ICON_SIZE}
          />
        </SSIconButton>
        {calendar.canWrite ? (
          <SSIconButton
            accessibilityLabel={t('nostrIdentity.calendar.newEvent')}
            style={HEADER_CHROME_HIT_BOX}
            onPress={handleCreate}
          >
            <SSIconPlus
              height={HEADER_INLINE_ICON_SIZE}
              width={HEADER_INLINE_ICON_SIZE}
            />
          </SSIconButton>
        ) : null}
      </SSHStack>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerRight: renderHeaderRight,
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.calendar.title')}</SSText>
          )
        }}
      />
      {calendar.isLoading ? (
        <SSVStack itemsCenter style={styles.center}>
          <ActivityIndicator color={Colors.gray[400]} />
        </SSVStack>
      ) : statusMessage ? (
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted" size="sm">
            {statusMessage}
          </SSText>
        </SSVStack>
      ) : (
        <SSScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={calendar.isRefetching}
              tintColor={Colors.gray[400]}
              onRefresh={handleRefresh}
            />
          }
        >
          {pendingRequests > 0 ? (
            <SSIconButton
              accessibilityRole="button"
              style={styles.requests}
              onPress={handleOpenCalendars}
            >
              <SSText size="xs" uppercase>
                {t('nostrIdentity.calendar.pendingRequests', {
                  count: pendingRequests
                })}
              </SSText>
            </SSIconButton>
          ) : null}
          <SSNostrCalendarView
            agendaPastRows={view.agendaPastRows}
            agendaUpcomingRows={view.agendaUpcomingRows}
            calendarFilter={view.calendarFilter}
            calendars={calendar.data.calendars}
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
            onOpenEvent={handleOpenEvent}
            onPreviousMonth={view.handlePreviousMonth}
            onSelectDay={view.handleSelectDay}
            onToday={view.handleToday}
          />
        </SSScrollView>
      )}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center'
  },
  content: {
    gap: 16,
    paddingBottom: 64,
    paddingTop: 8
  },
  header: {
    marginRight: -HEADER_CHROME_EDGE_NUDGE
  },
  requests: {
    alignItems: 'center',
    borderColor: Colors.warning,
    borderRadius: 4,
    borderWidth: 1,
    paddingVertical: 8
  }
})
