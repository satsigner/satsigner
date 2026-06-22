import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming
} from 'react-native-reanimated'

import { Colors } from '@/styles'

type SSEllipsisAnimationProps = {
  size?: number
  delay?: number
}

function SSEllipsisAnimation({
  size = 3,
  delay = 750
}: SSEllipsisAnimationProps) {
  const opacity1 = useSharedValue(0)
  const opacity2 = useSharedValue(0)
  const opacity3 = useSharedValue(0)

  const animatedStyles1 = useAnimatedStyle(() => ({ opacity: opacity1.value }))
  const animatedStyles2 = useAnimatedStyle(() => ({ opacity: opacity2.value }))
  const animatedStyles3 = useAnimatedStyle(() => ({ opacity: opacity3.value }))

  useEffect(() => {
    opacity1.set(
      withRepeat(withDelay(0, withTiming(1, { duration: delay * 3 })), -1)
    )
    opacity2.set(
      withRepeat(withDelay(delay, withTiming(1, { duration: delay * 2 })), -1)
    )
    opacity3.set(
      withRepeat(withDelay(delay * 2, withTiming(1, { duration: delay })), -1)
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dotSizeStyle = {
    borderRadius: Math.round(size / 2),
    height: size,
    width: size
  }

  return (
    <View style={[styles.containerBase, { gap: Math.round(size * 2) }]}>
      <Animated.View
        style={[styles.circleBase, dotSizeStyle, animatedStyles1]}
      />
      <Animated.View
        style={[styles.circleBase, dotSizeStyle, animatedStyles2]}
      />
      <Animated.View
        style={[styles.circleBase, dotSizeStyle, animatedStyles3]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  circleBase: {
    backgroundColor: Colors.gray[400]
  },
  containerBase: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 20
  }
})

export default SSEllipsisAnimation
