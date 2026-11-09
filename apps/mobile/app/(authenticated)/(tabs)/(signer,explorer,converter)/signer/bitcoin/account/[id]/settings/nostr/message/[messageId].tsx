import { Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet } from 'react-native'

import SSMessageDetail from '@/components/chat/SSMessageDetail'
import SSText from '@/components/SSText'
import { useNostrDeviceMessageDetail } from '@/hooks/useNostrDeviceMessageDetail'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

type DeviceMessageParams = {
  id: string
  messageId: string
}

function renderHeaderTitle() {
  return <SSText uppercase>{t('nostrIdentity.chat.message.title')}</SSText>
}

export default function DeviceChatMessageDetail() {
  const { id, messageId } = useLocalSearchParams<DeviceMessageParams>()
  const {
    copyText,
    deleteForEveryone,
    deleteForMe,
    deleting,
    detail,
    openMessage,
    reply
  } = useNostrDeviceMessageDetail(id, messageId)

  return (
    <SSMainLayout>
      <Stack.Screen options={{ headerTitle: renderHeaderTitle }} />
      {detail ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <SSMessageDetail
            message={detail.preview}
            rows={detail.rows}
            tags={detail.tags}
            parent={detail.parent}
            replies={detail.replies}
            canReply
            canDeleteForEveryone={detail.canDeleteForEveryone}
            deleting={deleting}
            onReply={reply}
            onCopyText={copyText}
            onDeleteForMe={deleteForMe}
            onDeleteForEveryone={deleteForEveryone}
            onOpenMessage={openMessage}
          />
        </ScrollView>
      ) : (
        <SSVStack itemsCenter style={styles.empty}>
          <SSText color="muted">
            {t('nostrIdentity.chat.message.notFound')}
          </SSText>
        </SSVStack>
      )}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32
  },
  empty: {
    flex: 1,
    justifyContent: 'center'
  }
})
