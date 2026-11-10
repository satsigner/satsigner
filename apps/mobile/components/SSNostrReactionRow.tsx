import { Image, StyleSheet, View } from 'react-native'

import SSNostrReactionGlyph from '@/components/SSNostrReactionGlyph'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import { type NostrReactionRow } from '@/types/models/Nostr'
import { formatRelativeTime } from '@/utils/date'

const AVATAR_SIZE = 32

type SSNostrReactionRowProps = {
  disabled?: boolean
  onPress: (authorNpub: string) => void
  row: NostrReactionRow
}

function SSNostrReactionRow({
  disabled = false,
  onPress,
  row
}: SSNostrReactionRowProps) {
  function handlePress() {
    onPress(row.authorNpub)
  }

  return (
    <SSPressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={handlePress}
    >
      <SSHStack gap="sm" style={styles.row}>
        {row.authorPicture ? (
          <Image source={{ uri: row.authorPicture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <SSText size="xs" weight="bold">
              {row.authorLabel[0]?.toUpperCase()}
            </SSText>
          </View>
        )}
        <SSVStack gap="none" style={styles.author}>
          <SSText size="sm" weight="medium" numberOfLines={1}>
            {row.authorLabel}
          </SSText>
          <SSText size="xxs" color="muted">
            {formatRelativeTime(row.createdAt)}
          </SSText>
        </SSVStack>
        <SSNostrReactionGlyph reaction={row.reaction} />
      </SSHStack>
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  author: {
    flex: 1,
    minWidth: 0
  },
  avatar: {
    borderRadius: AVATAR_SIZE / 2,
    height: AVATAR_SIZE,
    width: AVATAR_SIZE
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  row: {
    alignItems: 'center',
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  }
})

export default SSNostrReactionRow
