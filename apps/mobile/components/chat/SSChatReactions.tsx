import { StyleSheet } from 'react-native'

import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { NostrChatReactionSummary } from '@/types/models/Nostr'
import type { ChatAgentStatus } from '@/utils/nostrChatReactions'

const CHIP_HIT_SLOP = 4
const CHIP_PRESSED_OPACITY = 0.6

const STATUS_LABEL_KEYS: Record<ChatAgentStatus, string> = {
  answered: 'nostrIdentity.chat.reactions.status.answered',
  error: 'nostrIdentity.chat.reactions.status.error',
  working: 'nostrIdentity.chat.reactions.status.working'
}

type SSChatReactionsProps = {
  summaries: NostrChatReactionSummary[]
  /** Peer's status signal on my message (👀 ✅ ⚠️). */
  agentStatus: ChatAgentStatus | null
  /** Tapping my own chip takes the reaction back; without it chips are read-only. */
  onRemove?: (reactionIds: string[]) => void
}

function getChipText({ count, emoji }: NostrChatReactionSummary): string {
  return count > 1 ? `${emoji} ${count}` : emoji
}

function ReactionChip({
  summary,
  onRemove
}: {
  summary: NostrChatReactionSummary
  onRemove?: (reactionIds: string[]) => void
}) {
  const { ownReactionIds } = summary
  const isMine = ownReactionIds.length > 0
  const removable = isMine && onRemove !== undefined
  const chipText = getChipText(summary)
  function handlePress() {
    onRemove?.(ownReactionIds)
  }

  return (
    <SSPressable
      accessibilityLabel={
        removable
          ? t('nostrIdentity.chat.reactions.remove', { emoji: summary.emoji })
          : chipText
      }
      accessibilityRole={removable ? 'button' : undefined}
      activeOpacity={CHIP_PRESSED_OPACITY}
      disabled={!removable}
      hitSlop={CHIP_HIT_SLOP}
      onPress={handlePress}
      style={[styles.chip, isMine ? styles.ownChip : null]}
    >
      <SSText size="xs">{chipText}</SSText>
    </SSPressable>
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
  row: {
    flexWrap: 'wrap',
    marginTop: 6
  }
})

export default SSChatReactions
