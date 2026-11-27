import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSNostrCalendarList from '@/components/SSNostrCalendarList'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_CALENDAR_TITLE_MAX_LENGTH } from '@/constants/nostrCalendar'
import { useNostrCalendarsManage } from '@/hooks/useNostrCalendarsManage'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { NostrCalendarEvent } from '@/types/models/NostrCalendar'
import { nostrCalendarEventHref } from '@/utils/nostrNavigation'

type CalendarsParams = {
  npub: string
}

export default function NostrCalendarsScreen() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<CalendarsParams>()
  const screen = useNostrCalendarsManage(npub)
  const { editor } = screen

  function handleOpenEvent(event: NostrCalendarEvent) {
    router.navigate(nostrCalendarEventHref(npub, event.coordinate))
  }

  function handleChangeTitle(title: string) {
    screen.handleChangeEditor({ title })
  }

  function handleChangeDescription(description: string) {
    screen.handleChangeEditor({ description })
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.calendar.calendars')}</SSText>
          )
        }}
      />
      {screen.isLoading ? (
        <SSVStack itemsCenter style={styles.center}>
          <ActivityIndicator color={Colors.gray[400]} />
        </SSVStack>
      ) : (
        <SSScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <SSText size="sm" color="muted">
            {t('nostrIdentity.calendar.calendarsHint')}
          </SSText>
          <SSNostrCalendarList
            calendars={screen.calendars}
            canWrite={screen.canWrite}
            requests={screen.requests}
            onAcceptRequest={screen.handleAcceptRequest}
            onEditCalendar={screen.handleEditCalendar}
            onOpenEvent={handleOpenEvent}
          />
          {screen.canWrite ? (
            <SSButton
              label={t('nostrIdentity.calendar.newCalendar')}
              variant="secondary"
              onPress={screen.handleNewCalendar}
            />
          ) : null}
        </SSScrollView>
      )}
      <SSModal
        visible={editor !== undefined}
        title={
          editor?.calendar
            ? t('nostrIdentity.calendar.editCalendar')
            : t('nostrIdentity.calendar.newCalendar')
        }
        confirmLabel={t('common.save')}
        onConfirm={screen.handleSaveEditor}
        onClose={screen.handleCloseEditor}
      >
        <SSVStack gap="sm" widthFull>
          <SSTextInput
            align="left"
            size="small"
            value={editor?.title ?? ''}
            maxLength={NOSTR_CALENDAR_TITLE_MAX_LENGTH}
            placeholder={t('nostrIdentity.calendar.form.title')}
            onChangeText={handleChangeTitle}
          />
          <SSTextInput
            align="left"
            size="small"
            value={editor?.description ?? ''}
            placeholder={t('nostrIdentity.calendar.description')}
            onChangeText={handleChangeDescription}
          />
          {editor?.calendar ? (
            <SSButton
              label={t('nostrIdentity.calendar.deleteCalendar')}
              variant="danger"
              loading={screen.deleting}
              disabled={screen.deleting || screen.saving}
              onPress={screen.handleDeleteCalendar}
            />
          ) : null}
        </SSVStack>
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
  }
})
