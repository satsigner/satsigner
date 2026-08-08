import { useMemo, useRef } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type NostrChatMessage } from '@/types/models/Nostr'

type SSChatThreadProps = {
  messages: NostrChatMessage[]
  onSend: (text: string) => void
  sending?: boolean
  inputValue: string
  onInputChange: (text: string) => void
  emptyText?: string
}

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
  if (isToday) {
    return time
  }
  return `${date.toLocaleDateString()} ${time}`
}

function ChatBubble({ item }: { item: NostrChatMessage }) {
  const isOwn = item.direction === 'out'
  return (
    <View
      style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : undefined]}
    >
      <View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubblePeer,
          item.status === 'failed' ? styles.bubbleFailed : undefined
        ]}
      >
        <SSText size="md">{item.content}</SSText>
        <SSHStack gap="xxs" style={styles.metaRow}>
          <SSText size="xs" color="muted">
            {formatMessageTime(item.created_at)}
          </SSText>
          {item.status === 'pending' ? (
            <SSText size="xs" color="muted">
              · {t('nostrIdentity.chat.status.sending')}
            </SSText>
          ) : null}
          {item.status === 'failed' ? (
            <SSText size="xs" style={{ color: Colors.error }}>
              · {t('nostrIdentity.chat.status.failed')}
            </SSText>
          ) : null}
        </SSHStack>
      </View>
    </View>
  )
}

/**
 * Shared DM thread: inverted message list + composer. Transport-agnostic —
 * screens supply stored messages and an onSend implementation (NIP-04/NIP-17).
 */
export default function SSChatThread({
  messages,
  onSend,
  sending = false,
  inputValue,
  onInputChange,
  emptyText
}: SSChatThreadProps) {
  const listRef = useRef<FlatList<NostrChatMessage>>(null)

  const displayedMessages = useMemo(
    () => [...messages].reverse(),
    [messages]
  )

  function handleSend() {
    const text = inputValue.trim()
    if (!text) {
      return
    }
    onSend(text)
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={displayedMessages}
        renderItem={({ item }) => <ChatBubble item={item} />}
        keyExtractor={(item) => item.id}
        inverted
        initialNumToRender={25}
        maxToRenderPerBatch={15}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <SSText center color="muted" style={styles.emptyText}>
            {emptyText ?? t('nostrIdentity.chat.noMessages')}
          </SSText>
        }
      />
      <SSHStack gap="sm" style={styles.inputContainer}>
        <SSTextInput
          value={inputValue}
          onChangeText={onInputChange}
          placeholder={t('nostrIdentity.chat.messagePlaceholder')}
          multiline
          style={styles.input}
        />
        <SSButton
          style={styles.sendButton}
          label={t('nostrIdentity.chat.send')}
          onPress={handleSend}
          disabled={sending || !inputValue.trim()}
          loading={sending}
        />
      </SSHStack>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 12,
    marginTop: 6,
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  bubbleFailed: {
    borderColor: Colors.error,
    borderWidth: 1
  },
  bubbleOwn: {
    backgroundColor: Colors.gray[800]
  },
  bubblePeer: {
    backgroundColor: Colors.gray[900]
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start'
  },
  bubbleRowOwn: {
    justifyContent: 'flex-end'
  },
  container: {
    flex: 1
  },
  emptyText: {
    marginTop: 40,
    // Inverted list flips content vertically
    transform: [{ scaleY: -1 }]
  },
  input: {
    flex: 0.8,
    minHeight: 44
  },
  inputContainer: {
    paddingBottom: 8
  },
  listContent: {
    paddingBottom: 8
  },
  metaRow: {
    alignSelf: 'flex-end',
    marginTop: 2
  },
  sendButton: {
    flex: 0.2
  }
})
