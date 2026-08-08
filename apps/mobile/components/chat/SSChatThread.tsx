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
  /** Display labels matching the devices group chat author header. */
  ownAuthorName?: string
  peerAuthorName?: string
  peerAuthorNpubShort?: string
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

function ChatBubble({
  item,
  ownAuthorName,
  peerAuthorName,
  peerAuthorNpubShort
}: {
  item: NostrChatMessage
  ownAuthorName: string
  peerAuthorName: string
  peerAuthorNpubShort?: string
}) {
  const isOwn = item.direction === 'out'
  return (
    <View style={[styles.message, isOwn && styles.ownMessage]}>
      <SSHStack gap="xxs" justifyBetween>
        <SSHStack gap="xxs" style={styles.authorRow}>
          <View
            style={[
              styles.authorIndicator,
              { backgroundColor: isOwn ? Colors.white : Colors.gray[500] }
            ]}
          />
          <SSText size="sm" style={styles.authorName}>
            {isOwn ? ownAuthorName : peerAuthorName}
          </SSText>
          {isOwn ? (
            <SSText size="sm" color="muted">
              {t('nostrIdentity.chat.youSuffix')}
            </SSText>
          ) : null}
          {!isOwn && peerAuthorNpubShort ? (
            <SSText size="xs" color="muted">
              {peerAuthorNpubShort}
            </SSText>
          ) : null}
        </SSHStack>
        <SSHStack gap="xs" style={styles.metaRow}>
          <SSText size="xs" color="muted">
            {formatMessageTime(item.created_at)}
          </SSText>
          {item.status === 'pending' ? (
            <SSText size="xs" color="muted">
              ({t('nostrIdentity.chat.status.sending')})
            </SSText>
          ) : null}
          {item.status === 'failed' ? (
            <SSText size="xs" style={{ color: Colors.error }}>
              ({t('nostrIdentity.chat.status.failed')})
            </SSText>
          ) : null}
        </SSHStack>
      </SSHStack>
      <View style={styles.messageContentWrap}>
        <SSText size="md">{item.content}</SSText>
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
  emptyText,
  ownAuthorName,
  peerAuthorName,
  peerAuthorNpubShort
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
        renderItem={({ item }) => (
          <ChatBubble
            item={item}
            ownAuthorName={ownAuthorName ?? t('nostrIdentity.chat.you')}
            peerAuthorName={peerAuthorName ?? t('nostrIdentity.chat.peer')}
            peerAuthorNpubShort={peerAuthorNpubShort}
          />
        )}
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
  authorIndicator: {
    borderRadius: 4,
    height: 8,
    marginRight: 3,
    marginTop: 1,
    width: 8
  },
  authorName: {
    color: Colors.white
  },
  authorRow: {
    alignItems: 'center'
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
  // Mirrors the devices group chat message block.
  message: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    marginTop: 8,
    padding: 10,
    paddingBottom: 15,
    paddingTop: 5
  },
  messageContentWrap: {
    paddingLeft: 30
  },
  metaRow: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    marginTop: -2
  },
  ownMessage: {
    backgroundColor: Colors.gray[800]
  },
  sendButton: {
    flex: 0.2
  }
})
