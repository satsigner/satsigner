import { Pressable, StyleSheet, TextInput, View } from 'react-native'

import { SSIconX } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

const COMPOSER_HEIGHT = 56
const CANCEL_ICON_SIZE = 12
const CANCEL_HIT_SLOP = 12

type SSChatComposerReply = {
  authorName: string
  text: string
}

type SSChatComposerProps = {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  placeholder: string
  sendLabel: string
  maxLength: number
  disabled?: boolean
  loading?: boolean
  replyTo?: SSChatComposerReply
  onCancelReply?: () => void
}

function SSChatComposer({
  value,
  onChangeText,
  onSend,
  placeholder,
  sendLabel,
  maxLength,
  disabled = false,
  loading = false,
  replyTo,
  onCancelReply
}: SSChatComposerProps) {
  return (
    <SSVStack gap="xs" style={styles.container}>
      {replyTo ? (
        <SSHStack gap="sm" style={styles.replyBar}>
          <View style={styles.replyContent}>
            <SSText size="xs" color="muted" numberOfLines={1}>
              {t('nostrIdentity.chat.reply.replyingTo', {
                name: replyTo.authorName
              })}
            </SSText>
            <SSText size="sm" numberOfLines={1}>
              {replyTo.text}
            </SSText>
          </View>
          <Pressable
            accessibilityLabel={t('nostrIdentity.chat.reply.cancel')}
            hitSlop={CANCEL_HIT_SLOP}
            onPress={onCancelReply}
          >
            <SSIconX height={CANCEL_ICON_SIZE} width={CANCEL_ICON_SIZE} />
          </Pressable>
        </SSHStack>
      ) : null}
      <SSHStack gap="sm" style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.gray[500]}
          multiline
          maxLength={maxLength}
        />
        <View style={styles.sendButton}>
          <SSButton
            label={sendLabel}
            onPress={onSend}
            disabled={disabled || !value.trim()}
            loading={loading}
          />
        </View>
      </SSHStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16
  },
  input: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    color: Colors.white,
    flex: 1,
    maxHeight: COMPOSER_HEIGHT * 2,
    minHeight: COMPOSER_HEIGHT,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top'
  },
  inputRow: {
    alignItems: 'flex-end'
  },
  replyBar: {
    alignItems: 'center',
    backgroundColor: Colors.gray[900],
    borderLeftColor: Colors.gray[500],
    borderLeftWidth: 2,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  replyContent: {
    flex: 1
  },
  sendButton: {
    width: '22%'
  }
})

export default SSChatComposer
export type { SSChatComposerReply }
