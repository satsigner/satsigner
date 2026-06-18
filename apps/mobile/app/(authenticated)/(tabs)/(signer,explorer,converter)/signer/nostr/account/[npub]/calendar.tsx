import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { NostrAPI } from '@/api/nostr'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors, Layout } from '@/styles'

type CalendarParams = {
  npub: string
}

type CalendarEvent = {
  id: string
  title: string
  start: number
  end?: number
  location?: string
  description: string
  kind: number
}

function formatEventDate(unixTs: number): string {
  const date = new Date(unixTs * 1000)
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export default function NostrCalendar() {
  const { npub } = useLocalSearchParams<CalendarParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const effectiveRelays = identity?.relays?.length
    ? identity.relays
    : globalRelays

  const relayConnected = identity?.relayConnected === true
  const relaysAvailable = effectiveRelays.length > 0

  const {
    data: events = [],
    isLoading,
    isError
  } = useQuery({
    enabled: !!npub && relayConnected && relaysAvailable,
    queryFn: async () => {
      const api = new NostrAPI(effectiveRelays)
      try {
        return await api.fetchCalendarEvents(npub)
      } finally {
        api.disconnect()
      }
    },
    queryKey: ['nostr', 'calendar', npub],
    staleTime: 5 * 60_000
  })

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.calendar.title')}</SSText>
          )
        }}
      />
      {isLoading ? (
        <SSVStack itemsCenter style={styles.center}>
          <ActivityIndicator color={Colors.gray[400]} />
        </SSVStack>
      ) : !relayConnected ? (
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.account.relayDisconnected')}
          </SSText>
        </SSVStack>
      ) : !relaysAvailable ? (
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.account.relayNoRelays')}
          </SSText>
        </SSVStack>
      ) : isError ? (
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.account.relayAllFailed')}
          </SSText>
        </SSVStack>
      ) : events.length === 0 ? (
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.calendar.empty')}
          </SSText>
        </SSVStack>
      ) : (
        <FlashList
          data={events}
          estimatedItemSize={72}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <CalendarRow event={item} />}
        />
      )}
    </SSMainLayout>
  )
}

type CalendarRowProps = {
  event: CalendarEvent
}

function CalendarRow({ event }: CalendarRowProps) {
  return (
    <View style={styles.row}>
      <SSVStack gap="none" style={styles.rowText}>
        <SSText size="sm">{event.title}</SSText>
        <SSText size="xs" color="muted">
          {formatEventDate(event.start)}
          {event.end ? ` → ${formatEventDate(event.end)}` : ''}
        </SSText>
        {event.location ? (
          <SSText size="xs" color="muted">
            {event.location}
          </SSText>
        ) : null}
      </SSVStack>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center'
  },
  list: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingVertical: 8
  },
  row: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingVertical: 12
  },
  rowText: {
    flex: 1
  }
})
