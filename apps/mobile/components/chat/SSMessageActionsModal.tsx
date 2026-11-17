import { Pressable, StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import { NOSTR_CHAT_REACTION_CHOICES } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

const REACTION_HIT_SLOP = 4

type SSMessageActionsModalProps = {
  visible: boolean
  preview: string
  canReply: boolean
  onReply: () => void
  onCopy: () => void
  onDetails: () => void
  onClose: () => void
  /** Reactions are offered (NIP-17 threads) only when this is set. */
  onReact?: (emoji: string) => void
}

function ReactionChoice({
  emoji,
  onReact
}: {
  emoji: string
  onReact: (emoji: string) => void
}) {
  function handlePress() {
    onReact(emoji)
  }
  return (
    <Pressable
      accessibilityLabel={t('nostrIdentity.chat.reactions.add', { emoji })}
      hitSlop={REACTION_HIT_SLOP}
      onPress={handlePress}
      style={({ pressed }) => [styles.reaction, pressed && styles.pressed]}
    >
      <SSText size="xl">{emoji}</SSText>
    </Pressable>
  )
}

/** Long-press menu of a chat message; deletion lives on the details page. */
function SSMessageActionsModal({
  visible,
  preview,
  canReply,
  onReply,
  onCopy,
  onDetails,
  onClose,
  onReact
}: SSMessageActionsModalProps) {
  return (
    <SSModal visible={visible} onClose={onClose}>
      <SSVStack gap="sm" style={styles.menu}>
        <SSText color="muted" numberOfLines={3} center>
          {preview}
        </SSText>
        {onReact ? (
          <SSHStack gap="xs" style={styles.reactions}>
            {NOSTR_CHAT_REACTION_CHOICES.map((emoji) => (
              <ReactionChoice key={emoji} emoji={emoji} onReact={onReact} />
            ))}
          </SSHStack>
        ) : null}
        {canReply ? (
          <SSButton
            label={t('nostrIdentity.chat.message.reply')}
            onPress={onReply}
          />
        ) : null}
        <SSButton
          label={t('nostrIdentity.chat.message.copyText')}
          onPress={onCopy}
          variant="outline"
        />
        <SSButton
          label={t('nostrIdentity.chat.actions.details')}
          onPress={onDetails}
          variant="outline"
        />
      </SSVStack>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  menu: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center'
  },
  pressed: {
    opacity: 0.6
  },
  reaction: {
    backgroundColor: Colors.gray[850],
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  reactions: {
    flexWrap: 'wrap',
    justifyContent: 'center'
  }
})

export default SSMessageActionsModal
