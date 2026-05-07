import { type ReactNode } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SSIconCloseThin } from '@/components/icons'
import SSText from '@/components/SSText'
import { type TourBubblePosition } from '@/constants/tour'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'

type SSTourSpeechBubbleProps = {
  position: TourBubblePosition
  title: string
  description: string
  stepLabel?: string
  onExit?: () => void
  heroic?: boolean
  children?: ReactNode
  arrowDirection?: 'up' | 'down'
  bottomOffset?: number
}

function SSTourSpeechBubble({
  position,
  title,
  description,
  stepLabel,
  onExit,
  heroic = false,
  children,
  arrowDirection,
  bottomOffset = 16
}: SSTourSpeechBubbleProps) {
  const insets = useSafeAreaInsets()
  const isBottom = position === 'bottom'
  const isTop = position === 'top'
  const showArrowUp =
    (isBottom || isTop) && arrowDirection !== 'down'
  const showArrowDown = arrowDirection === 'down'

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        position === 'top' && styles.wrapperTop,
        position === 'center' && styles.wrapperCenter,
        position === 'bottom' && {
          ...styles.wrapperBottom,
          bottom: insets.bottom + bottomOffset
        }
      ]}
    >
      {showArrowUp && <View style={styles.arrowUp} />}
      <View style={[styles.bubble, heroic && styles.bubbleHeroic]}>
        {onExit && (
          <TouchableOpacity
            style={styles.exitCorner}
            onPress={onExit}
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
          >
            <SSIconCloseThin width={12} height={12} />
          </TouchableOpacity>
        )}
        <SSVStack gap={heroic ? 'md' : 'xs'}>
          <SSVStack gap="xs">
            {stepLabel && (
              <SSText size="2xxs" color="muted" uppercase>
                {stepLabel}
              </SSText>
            )}
            <SSText size={heroic ? 'lg' : 'sm'} weight="medium" color="white">
              {title}
            </SSText>
            <SSText size={heroic ? 'sm' : 'xs'} color="muted">
              {description}
            </SSText>
          </SSVStack>
          {children && <SSVStack gap="xs">{children}</SSVStack>}
        </SSVStack>
      </View>
      {showArrowDown && <View style={styles.arrowDown} />}
    </View>
  )
}

const styles = StyleSheet.create({
  arrowDown: {
    alignSelf: 'center',
    borderLeftColor: 'transparent',
    borderLeftWidth: 10,
    borderRightColor: 'transparent',
    borderRightWidth: 10,
    borderTopColor: Colors.gray[800],
    borderTopWidth: 10,
    height: 0,
    width: 0
  },
  arrowUp: {
    alignSelf: 'center',
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderLeftWidth: 10,
    borderRightColor: 'transparent',
    borderRightWidth: 10,
    height: 0,
    width: 0
  },
  bubble: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    padding: 10
  },
  bubbleHeroic: {
    borderColor: Colors.gray[600],
    padding: 20
  },
  exitCorner: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1
  },
  wrapper: {
    alignSelf: 'center',
    width: '60%'
  },
  wrapperBottom: {
    left: '20%',
    position: 'absolute',
    right: '20%'
  },
  wrapperCenter: {
    left: '20%',
    position: 'absolute',
    right: '20%',
    top: '35%'
  },
  wrapperTop: {
    left: '20%',
    position: 'absolute',
    right: '20%',
    top: 240
  }
})

export default SSTourSpeechBubble
