import { useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSDetailRow from '@/components/SSDetailRow'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import {
  type NostrMessageDetailRow,
  type NostrMessagePreview
} from '@/utils/nostrMessageDetail'

type DeleteConfirmation = 'everyone' | 'me' | null

type SSMessageDetailProps = {
  message: NostrMessagePreview
  rows: NostrMessageDetailRow[]
  /** Pretty-printed rumor tags, when the rumor is stored. */
  tags?: string | null
  parent: NostrMessagePreview | null
  replies: NostrMessagePreview[]
  canReply: boolean
  canDeleteForEveryone: boolean
  deleting: boolean
  onReply: () => void
  onCopyText: () => void
  onDeleteForMe: () => void
  onDeleteForEveryone: () => void
  onOpenMessage: (messageId: string) => void
}

type MessagePreviewRowProps = {
  preview: NostrMessagePreview
  onOpen: (messageId: string) => void
}

function MessagePreviewRow({ preview, onOpen }: MessagePreviewRowProps) {
  function handlePress() {
    onOpen(preview.id)
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.preview, pressed && styles.pressed]}
    >
      <SSVStack gap="xxs">
        <SSHStack justifyBetween>
          <SSText size="xs" weight="medium">
            {preview.authorLabel}
          </SSText>
          <SSText size="xs" color="muted">
            {preview.date}
          </SSText>
        </SSHStack>
        <SSText size="sm" color="muted" numberOfLines={3}>
          {preview.text}
        </SSText>
      </SSVStack>
    </Pressable>
  )
}

function MessageDetailRow({ row }: { row: NostrMessageDetailRow }) {
  if (!row.copyValue) {
    return <SSDetailRow label={row.label} value={row.value} />
  }
  return (
    <SSClipboardCopy text={row.copyValue} fullWidth>
      <SSDetailRow label={row.label} value={row.value} />
    </SSClipboardCopy>
  )
}

function SSMessageDetail({
  message,
  rows,
  tags,
  parent,
  replies,
  canReply,
  canDeleteForEveryone,
  deleting,
  onReply,
  onCopyText,
  onDeleteForMe,
  onDeleteForEveryone,
  onOpenMessage
}: SSMessageDetailProps) {
  const [confirmation, setConfirmation] = useState<DeleteConfirmation>(null)

  function closeConfirmation() {
    setConfirmation(null)
  }

  function askDeleteForMe() {
    setConfirmation('me')
  }

  function askDeleteForEveryone() {
    setConfirmation('everyone')
  }

  function confirmDelete() {
    const deleteMessage =
      confirmation === 'everyone' ? onDeleteForEveryone : onDeleteForMe
    setConfirmation(null)
    deleteMessage()
  }

  return (
    <SSVStack gap="lg">
      <SSVStack gap="xs" style={styles.card}>
        <SSHStack justifyBetween>
          <SSText size="sm" weight="medium">
            {message.authorLabel}
          </SSText>
          <SSText size="xs" color="muted">
            {message.date}
          </SSText>
        </SSHStack>
        <SSText selectable>{message.text}</SSText>
      </SSVStack>

      {parent && (
        <SSVStack gap="xs">
          <SSText color="muted" uppercase size="xs">
            {t('nostrIdentity.chat.message.replyTo')}
          </SSText>
          <MessagePreviewRow preview={parent} onOpen={onOpenMessage} />
        </SSVStack>
      )}

      <SSVStack gap="none">
        {rows.map((row) => (
          <MessageDetailRow key={row.key} row={row} />
        ))}
      </SSVStack>

      {tags && (
        <SSVStack gap="xs">
          <SSText color="muted" uppercase size="xs">
            {t('nostrIdentity.chat.message.tags')}
          </SSText>
          <SSText type="mono" size="xs" selectable style={styles.tags}>
            {tags}
          </SSText>
        </SSVStack>
      )}

      {replies.length > 0 && (
        <SSVStack gap="xs">
          <SSText color="muted" uppercase size="xs">
            {t('nostrIdentity.chat.message.replies', { count: replies.length })}
          </SSText>
          {replies.map((reply) => (
            <MessagePreviewRow
              key={reply.id}
              preview={reply}
              onOpen={onOpenMessage}
            />
          ))}
        </SSVStack>
      )}

      <SSVStack gap="sm">
        {canReply && (
          <SSButton
            label={t('nostrIdentity.chat.message.reply')}
            variant="secondary"
            onPress={onReply}
          />
        )}
        <SSButton
          label={t('nostrIdentity.chat.message.copyText')}
          variant="outline"
          onPress={onCopyText}
        />
        <SSButton
          label={t('nostrIdentity.chat.message.deleteForMe')}
          variant="outline"
          onPress={askDeleteForMe}
          disabled={deleting}
        />
        {canDeleteForEveryone && (
          <SSButton
            label={t('nostrIdentity.chat.message.deleteForEveryone')}
            variant="danger"
            onPress={askDeleteForEveryone}
            loading={deleting}
            disabled={deleting}
          />
        )}
      </SSVStack>

      <SSModal
        visible={confirmation !== null}
        title={
          confirmation === 'everyone'
            ? t('nostrIdentity.chat.message.deleteForEveryone')
            : t('nostrIdentity.chat.message.deleteForMe')
        }
        confirmLabel={t('nostrIdentity.chat.message.delete')}
        onConfirm={confirmDelete}
        onClose={closeConfirmation}
      >
        <SSText center color="muted">
          {confirmation === 'everyone'
            ? t('nostrIdentity.chat.message.deleteForEveryoneWarning')
            : t('nostrIdentity.chat.message.deleteForMeWarning')}
        </SSText>
      </SSModal>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    padding: 12
  },
  pressed: {
    opacity: 0.6
  },
  preview: {
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 10
  },
  tags: {
    backgroundColor: Colors.gray[950],
    borderRadius: 6,
    padding: 8
  }
})

export default SSMessageDetail
