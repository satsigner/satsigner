import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSNostrCalendarEventForm from '@/components/SSNostrCalendarEventForm'
import SSText from '@/components/SSText'
import { useNostrCalendarEventEdit } from '@/hooks/useNostrCalendarEventEdit'
import { useNostrCalendarFetch } from '@/hooks/useNostrCalendarFetch'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

type EditParams = {
  coordinate?: string
  date?: string
  npub: string
}

type EditFormProps = EditParams & {
  onDone: () => void
}

/** Mounted once the calendar is loaded, so an edit starts from the event. */
function EditForm({ coordinate, date, npub, onDone }: EditFormProps) {
  const form = useNostrCalendarEventEdit(npub, { coordinate, date })

  function handleSave() {
    form.handleSave(onDone)
  }

  if (form.missing) {
    return (
      <SSVStack itemsCenter style={styles.center}>
        <SSText color="muted">{t('nostrIdentity.calendar.notFound')}</SSText>
      </SSVStack>
    )
  }

  if (!form.canWrite) {
    return (
      <SSVStack itemsCenter style={styles.center}>
        <SSText color="muted">{t('nostrIdentity.keys.watchOnly')}</SSText>
      </SSVStack>
    )
  }

  return (
    <SSScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <SSNostrCalendarEventForm
        calendars={form.calendars}
        draft={form.draft}
        error={form.error}
        todayKey={form.todayKey}
        onChange={form.handleChange}
      />
      <SSButton
        label={
          form.saving
            ? t('nostrIdentity.calendar.publishing')
            : t('nostrIdentity.calendar.publish')
        }
        variant="gradient"
        gradientType="special"
        loading={form.saving}
        disabled={form.saving}
        onPress={handleSave}
      />
    </SSScrollView>
  )
}

export default function NostrCalendarEditScreen() {
  const router = useRouter()
  const { coordinate, date, npub } = useLocalSearchParams<EditParams>()
  const { isLoading } = useNostrCalendarFetch(npub)

  function handleDone() {
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {coordinate
                ? t('nostrIdentity.calendar.editEvent')
                : t('nostrIdentity.calendar.newEvent')}
            </SSText>
          )
        }}
      />
      {isLoading ? (
        <SSVStack itemsCenter style={styles.center}>
          <ActivityIndicator color={Colors.gray[400]} />
        </SSVStack>
      ) : (
        <EditForm
          coordinate={coordinate}
          date={date}
          npub={npub}
          onDone={handleDone}
        />
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
    gap: 24,
    paddingBottom: 64,
    paddingTop: 8
  }
})
