import { Pressable, StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { NostrChatReactionSummary } from '@/types/models/Nostr'
import type { ChatAgentStatus } from '@/utils/nostrChatReactions'

const CHIP_HIT_SLOP = 4

const STATUS_LABEL_KEYS: Record<ChatAgentStatus, string> = {
  answered: 'nostrIdentity.chat.reactions.status.answered',
  error: 'nostrIdentity.chat.reactions.status.error',
  working: 'nostrIdentity.chat.reactions.status.working'
}

type SSChatReactionsProps = {
  summaries: NostrChatReactionSummary[]
  /** Peer's status signal on my message (👀 ✅ ⚠️). */
  agentStatus: ChatAgentStatus | null
  /** Tapping my own chip takes the reaction back. */
  onRemove: (reactionId: string) => void
}

function ReactionChip({
  summary,
  onRemove
}: {
  summary: NostrChatReactionSummary
  onRemove: (reactionId: string) => void
}) {
  const { ownReactionId } = summary
  function handlePress() {
    if (ownReactionId) {
      onRemove(ownReactionId)
    }
  }

  return (
    <Pressable
      accessibilityLabel={
        ownReactionId
          ? t('nostrIdentity.chat.reactions.remove', { emoji: summary.emoji })
          : summary.emoji
      }
      disabled={!ownReactionId}
      hitSlop={CHIP_HIT_SLOP}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.chip,
        ownReactionId ? styles.ownChip : null,
        pressed && styles.pressed
      ]}
    >
      <SSText size="xs">
        {summary.emoji}
        {summary.count > 1 ? ` ${summary.count}` : ''}
      </SSText>
    </Pressable>
  )
}

function SSChatReactions({
  summaries,
  agentStatus,
  onRemove
}: SSChatReactionsProps) {
  if (summaries.length === 0 && agentStatus === null) {
    return null
  }
  return (
    <SSHStack gap="xs" style={styles.row}>
      {agentStatus ? (
        <SSText
          size="xs"
          color="muted"
          style={agentStatus === 'error' ? styles.errorStatus : undefined}
        >
          {t(STATUS_LABEL_KEYS[agentStatus])}
        </SSText>
      ) : null}
      {summaries.map((summary) => (
        <ReactionChip
          key={summary.emoji}
          summary={summary}
          onRemove={onRemove}
        />
      ))}
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: Colors.gray[850],
    borderColor: Colors.gray[700],
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  errorStatus: {
    color: Colors.warning
  },
  ownChip: {
    borderColor: Colors.gray[300]
  },
  pressed: {
    opacity: 0.6
  },
  row: {
    flexWrap: 'wrap',
    marginTop: 6
  }
})

export default SSChatReactions
