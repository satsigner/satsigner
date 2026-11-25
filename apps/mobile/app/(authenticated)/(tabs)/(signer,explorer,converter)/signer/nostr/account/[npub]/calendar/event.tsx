import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSNostrCalendarEventDetail from '@/components/SSNostrCalendarEventDetail'
import SSNostrCalendarRsvp from '@/components/SSNostrCalendarRsvp'
import SSText from '@/components/SSText'
import { useNostrCalendarEvent } from '@/hooks/useNostrCalendarEvent'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { safeNpubEncode } from '@/utils/nostr'
import {
  nostrAuthorProfileHref,
  nostrCalendarEditHref
} from '@/utils/nostrNavigation'
import { openUrl } from '@/utils/url'

type EventParams = {
  coordinate: string
  npub: string
}

export default function NostrCalendarEventScreen() {
  const router = useRouter()
  const { coordinate, npub } = useLocalSearchParams<EventParams>()
  const screen = useNostrCalendarEvent(npub, coordinate)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleOpenParticipant(pubkey: string) {
    router.navigate(nostrAuthorProfileHref(npub, safeNpubEncode(pubkey)))
  }

  function handleOpenLink(url: string) {
    void openUrl(url)
  }

  function handleEdit() {
    router.navigate(nostrCalendarEditHref(npub, { coordinate }))
  }

  function handleCopy() {
    void screen.handleCopyAddress()
  }

  function handleAskDelete() {
    setConfirmDelete(true)
  }

  function handleCloseDelete() {
    setConfirmDelete(false)
  }

  function handleConfirmDelete() {
    setConfirmDelete(false)
    screen.handleDelete(() => router.back())
  }

  const header = (
    <Stack.Screen
      options={{
        headerTitle: () => (
          <SSText uppercase>{t('nostrIdentity.calendar.event')}</SSText>
        )
      }}
    />
  )

  if (screen.isLoading) {
    return (
      <SSMainLayout>
        {header}
        <SSVStack itemsCenter style={styles.center}>
          <ActivityIndicator color={Colors.gray[400]} />
        </SSVStack>
      </SSMainLayout>
    )
  }

  if (!screen.event) {
    return (
      <SSMainLayout>
        {header}
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted">{t('nostrIdentity.calendar.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      {header}
      <SSScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <SSNostrCalendarEventDetail
          calendarTitles={screen.calendarTitles}
          event={screen.event}
          organizerLabel={screen.organizerLabel}
          participants={screen.participants}
          timezoneLabel={screen.timezoneLabel}
          when={screen.when}
          onOpenLink={handleOpenLink}
          onOpenParticipant={handleOpenParticipant}
        />
        <SSNostrCalendarRsvp
          canRespond={screen.canRespond}
          freeBusy={screen.freeBusy}
          note={screen.note}
          sending={screen.rsvpSending}
          sentStatus={screen.sentStatus}
          status={screen.status}
          summary={screen.summary}
          onChangeFreeBusy={screen.setFreeBusy}
          onChangeNote={screen.setNote}
          onChangeStatus={screen.setStatus}
          onSubmit={screen.handleSubmitRsvp}
        />
        <SSButton
          label={t('nostrIdentity.calendar.copyAddress')}
          variant="outline"
          onPress={handleCopy}
        />
        {screen.canEdit ? (
          <SSHStack gap="sm">
            <SSButton
              label={t('nostrIdentity.calendar.edit')}
              variant="secondary"
              style={styles.flex}
              onPress={handleEdit}
            />
            <SSButton
              label={t('common.delete')}
              variant="danger"
              style={styles.flex}
              loading={screen.deleting}
              disabled={screen.deleting}
              onPress={handleAskDelete}
            />
          </SSHStack>
        ) : null}
      </SSScrollView>
      <SSModal
        visible={confirmDelete}
        title={t('nostrIdentity.calendar.deleteTitle')}
        confirmLabel={t('common.delete')}
        onConfirm={handleConfirmDelete}
        onClose={handleCloseDelete}
      >
        <SSText center color="muted">
          {t('nostrIdentity.calendar.deleteConfirm')}
        </SSText>
      </SSModal>
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
  flex: {
    flex: 1
  }
})
