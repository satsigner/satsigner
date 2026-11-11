import { type ReactNode } from 'react'
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'

import SSIconHeart from '@/components/icons/SSIconHeart'
import SSIconLightning from '@/components/icons/SSIconLightning'
import SSIconRepost from '@/components/icons/SSIconRepost'
import SSIconButton from '@/components/SSIconButton'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { formatShortSats } from '@/utils/format'

const ACTION_HIT_SLOP = 6
const ZAP_LONG_PRESS_DELAY_MS = 400
const ICON_STROKE_WIDTH = 1.5
const LIGHTNING_ASPECT = 16 / 20
const LIGHTNING_SCALE = 0.72

const ICON_SIZE = {
  md: 20,
  sm: 18
} as const

type ZapAction = {
  canZap: boolean
  onLongPress: () => void
  onPress: () => void
  totalSats?: number
  zapping: boolean
}

type SSNostrNoteActionsProps = {
  canEngage: boolean
  children?: ReactNode
  likeCount: number
  likedByMe: boolean
  onLikeCountPress?: () => void
  onLikePress: () => void
  onRepostPress: () => void
  repostCount: number
  repostedByMe: boolean
  showCounts?: boolean
  size?: keyof typeof ICON_SIZE
  style?: StyleProp<ViewStyle>
  toggling: boolean
  zap?: ZapAction
}

function ActionCount({
  active,
  count,
  label,
  visible
}: {
  active: boolean
  count: number
  label?: string
  visible: boolean
}) {
  if (!visible || count === 0) {
    return null
  }
  return (
    <SSText size="xs" color={active ? 'white' : 'muted'}>
      {label ?? count}
    </SSText>
  )
}

function SSNostrNoteActions({
  canEngage,
  children,
  likeCount,
  likedByMe,
  onLikeCountPress,
  onLikePress,
  onRepostPress,
  repostCount,
  repostedByMe,
  showCounts = true,
  size = 'md',
  style,
  toggling,
  zap
}: SSNostrNoteActionsProps) {
  const iconSize = ICON_SIZE[size]
  const disabled = !canEngage || toggling
  const likeCountPressable =
    Boolean(onLikeCountPress) && showCounts && likeCount > 0

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
        style={[styles.action, likeCountPressable && styles.actionBeforeCount]}
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
          visible={showCounts && !likeCountPressable}
        />
      </SSIconButton>
      {likeCountPressable ? (
        <SSPressable
          accessibilityLabel={t('nostrIdentity.note.reactions.showAll')}
          accessibilityRole="button"
          hitSlop={ACTION_HIT_SLOP}
          onPress={onLikeCountPress}
          style={styles.count}
        >
          <ActionCount active={likedByMe} count={likeCount} visible />
        </SSPressable>
      ) : null}
      {zap ? (
        <SSIconButton
          accessibilityHint={t('nostrIdentity.note.zapLongPressHint')}
          accessibilityLabel={t('nostrIdentity.note.zap')}
          accessibilityState={{ busy: zap.zapping, disabled: !zap.canZap }}
          delayLongPress={ZAP_LONG_PRESS_DELAY_MS}
          disabled={!zap.canZap || zap.zapping}
          hitSlop={ACTION_HIT_SLOP}
          onLongPress={zap.onLongPress}
          onPress={zap.onPress}
          style={[styles.action, styles.zapAction]}
        >
          <View style={[styles.bolt, { height: iconSize, width: iconSize }]}>
            <SSIconLightning
              width={iconSize * LIGHTNING_SCALE * LIGHTNING_ASPECT}
              height={iconSize * LIGHTNING_SCALE}
              stroke={zap.zapping ? Colors.gold : Colors.gray[300]}
              strokeWidth={ICON_STROKE_WIDTH}
            />
          </View>
          <ActionCount
            active={zap.zapping}
            count={zap.totalSats ?? 0}
            visible={showCounts}
            label={formatShortSats(zap.totalSats ?? 0)}
          />
        </SSIconButton>
      ) : null}
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
  actionBeforeCount: {
    minWidth: 0,
    paddingRight: 6
  },
  bolt: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  count: {
    justifyContent: 'center',
    minHeight: 36,
    paddingRight: 12
  },
  row: {
    alignItems: 'center'
  },
  zapAction: {
    minWidth: 0
  }
})

export default SSNostrNoteActions
