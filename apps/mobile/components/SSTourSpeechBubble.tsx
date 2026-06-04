import { useEffect, type ReactNode } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SSIconCloseThin } from '@/components/icons'
import SSText from '@/components/SSText'
import { type TourBubblePosition } from '@/constants/tour'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

const SPRING_CONFIG = { damping: 22, mass: 1.2, stiffness: 100 }
const FADE_DURATION_MS = 280
const INITIAL_SCALE = 0.92
const ENTER_OFFSET_PX = 18

type SSTourSpeechBubbleProps = {
  position: TourBubblePosition
  title: string
  description: string
  stepLabel?: string
  onExit?: () => void
  inverted?: boolean
  children?: ReactNode
  arrowDirection?: 'up' | 'down'
  bottomOffset?: number
  wrapperStyle?: ViewStyle
}

function SSTourSpeechBubble({
  position,
  title,
  description,
  stepLabel,
  onExit,
  inverted,
  children,
  arrowDirection,
  bottomOffset = 16,
  wrapperStyle
}: SSTourSpeechBubbleProps) {
  const insets = useSafeAreaInsets()
  const isBottom = position === 'bottom'
  const isTop = position === 'top'
  const showArrowUp = (isBottom || isTop) && arrowDirection !== 'down'
  const showArrowDown = arrowDirection === 'down'
  const isInverted = inverted !== undefined ? inverted : true
  const arrowUpStyle = [
    styles.arrowUp,
    !isInverted && { borderBottomColor: Colors.gray[800] }
  ]
  const arrowDownStyle = [
    styles.arrowDown,
    !isInverted && { borderTopColor: Colors.gray[800] }
  ]

  const initialTranslateY = isBottom
    ? ENTER_OFFSET_PX
    : isTop
      ? -ENTER_OFFSET_PX
      : ENTER_OFFSET_PX / 2

  const opacity = useSharedValue(0)
  const scale = useSharedValue(INITIAL_SCALE)
  const translateY = useSharedValue(initialTranslateY)

  useEffect(() => {
    opacity.value = withTiming(1, { duration: FADE_DURATION_MS })
    scale.value = withSpring(1, SPRING_CONFIG)
    translateY.value = withSpring(0, SPRING_CONFIG)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }]
  }))

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        position === 'top' && styles.wrapperTop,
        position === 'center' && styles.wrapperCenter,
        position === 'bottom' && {
          ...styles.wrapperBottom,
          bottom: insets.bottom + bottomOffset
        },
        wrapperStyle,
        animatedStyle
      ]}
    >
      {showArrowUp && <View style={arrowUpStyle} />}
      <View style={styles.bubble}>
        {onExit && (
          <TouchableOpacity
            accessibilityLabel={t('common.close')}
            style={styles.exitCorner}
            onPress={onExit}
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
          >
            <SSIconCloseThin width={12} height={12} color={Colors.gray[500]} />
          </TouchableOpacity>
        )}
        <SSVStack gap="xs">
          <SSVStack gap="xs">
            {stepLabel && (
              <SSText
                size="2xxs"
                color={isInverted ? 'black' : 'muted'}
                uppercase
              >
                {stepLabel}
              </SSText>
            )}
            <SSText
              size="sm"
              weight="medium"
              color={isInverted ? 'black' : 'white'}
            >
              {title}
            </SSText>
            {description.trim().length > 0 && (
              <SSText size="xs" color={isInverted ? 'black' : 'muted'}>
                {description}
              </SSText>
            )}
          </SSVStack>
          {children && <SSVStack gap="xs">{children}</SSVStack>}
        </SSVStack>
      </View>
      {showArrowDown && <View style={arrowDownStyle} />}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  arrowDown: {
    alignSelf: 'center',
    borderLeftColor: 'transparent',
    borderLeftWidth: 10,
    borderRightColor: 'transparent',
    borderRightWidth: 10,
    borderTopColor: Colors.white,
    borderTopWidth: 10,
    height: 0,
    width: 0
  },
  arrowUp: {
    alignSelf: 'center',
    borderBottomColor: Colors.white,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderLeftWidth: 10,
    borderRightColor: 'transparent',
    borderRightWidth: 10,
    height: 0,
    width: 0
  },
  bubble: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 10
  },
  exitCorner: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1
  },
  wrapper: {
    alignSelf: 'center',
    width: '55%'
  },
  wrapperBottom: {
    left: '22.5%',
    position: 'absolute',
    right: '22.5%'
  },
  wrapperCenter: {
    left: '22.5%',
    position: 'absolute',
    right: '22.5%',
    top: '35%'
  },
  wrapperTop: {
    left: '22.5%',
    position: 'absolute',
    right: '22.5%',
    top: 200
  }
})

export default SSTourSpeechBubble
