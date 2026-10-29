import { type ReactNode } from 'react'
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native'

import SSIconHeart from '@/components/icons/SSIconHeart'
import SSIconRepost from '@/components/icons/SSIconRepost'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

const ACTION_HIT_SLOP = 6

const ICON_SIZE = {
  md: 20,
  sm: 18
} as const

type SSNostrNoteActionsProps = {
  canEngage: boolean
  children?: ReactNode
  likeCount: number
  likedByMe: boolean
  onLikePress: () => void
  onRepostPress: () => void
  repostCount: number
  repostedByMe: boolean
  showCounts?: boolean
  size?: keyof typeof ICON_SIZE
  style?: StyleProp<ViewStyle>
  toggling: boolean
}

function ActionCount({
  active,
  count,
  visible
}: {
  active: boolean
  count: number
  visible: boolean
}) {
  if (!visible || count === 0) {
    return null
  }
  return (
    <SSText size="xs" color={active ? 'white' : 'muted'}>
      {count}
    </SSText>
  )
}

function SSNostrNoteActions({
  canEngage,
  children,
  likeCount,
  likedByMe,
  onLikePress,
  onRepostPress,
  repostCount,
  repostedByMe,
  showCounts = true,
  size = 'md',
  style,
  toggling
}: SSNostrNoteActionsProps) {
  const iconSize = ICON_SIZE[size]
  const disabled = !canEngage || toggling

  return (
    <SSHStack gap="none" style={[styles.row, style]}>
      <SSIconButton
        accessibilityLabel={t(
          repostedByMe
            ? 'nostrIdentity.note.undoRepostTitle'
            : 'nostrIdentity.note.repostTitle'
        )}
        accessibilityState={{ disabled, selected: repostedByMe }}
        disabled={disabled}
        hitSlop={ACTION_HIT_SLOP}
        onPress={onRepostPress}
        style={styles.action}
      >
        <SSIconRepost
          width={iconSize}
          height={iconSize}
          color={repostedByMe ? Colors.mainGreen : undefined}
        />
        <ActionCount
          active={repostedByMe}
          count={repostCount}
          visible={showCounts}
        />
      </SSIconButton>
      <SSIconButton
        accessibilityLabel={t(
          likedByMe
            ? 'nostrIdentity.note.unlikeTitle'
            : 'nostrIdentity.note.likeTitle'
        )}
        accessibilityState={{ disabled, selected: likedByMe }}
        disabled={disabled}
        hitSlop={ACTION_HIT_SLOP}
        onPress={onLikePress}
        style={styles.action}
      >
        <SSIconHeart
          width={iconSize}
          height={iconSize}
          color={likedByMe ? Colors.mainRed : undefined}
          filled={likedByMe}
        />
        <ActionCount
          active={likedByMe}
          count={likeCount}
          visible={showCounts}
        />
      </SSIconButton>
      {children}
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    minWidth: 52,
    paddingRight: 12
  },
  row: {
    alignItems: 'center'
  }
})

export default SSNostrNoteActions
