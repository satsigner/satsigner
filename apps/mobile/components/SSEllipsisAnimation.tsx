import { useEffect, useMemo } from 'react'
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
}

function SSEllipsisAnimation({ size = 3 }: SSEllipsisAnimationProps) {
  const opacity1 = useSharedValue(0)
  const opacity2 = useSharedValue(0)
  const opacity3 = useSharedValue(0)

  const animatedStyles1 = useAnimatedStyle(() => ({ opacity: opacity1.value }))
  const animatedStyles2 = useAnimatedStyle(() => ({ opacity: opacity2.value }))
  const animatedStyles3 = useAnimatedStyle(() => ({ opacity: opacity3.value }))

  useEffect(() => {
    opacity1.value = withRepeat(
      withDelay(0, withTiming(1, { duration: 2250 })),
      -1
    )
    opacity2.value = withRepeat(
      withDelay(750, withTiming(1, { duration: 1500 })),
      -1
    )
    opacity3.value = withRepeat(
      withDelay(1500, withTiming(1, { duration: 750 })),
      -1
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const containerStyle = useMemo(
    () =>
      StyleSheet.compose(styles.containerBase, {
        gap: Math.round(size * 2)
      }),
    [size]
  )

  const dotStyle = useMemo(
    () =>
      StyleSheet.compose(styles.circleBase, {
        borderRadius: Math.round(size / 2),
        height: size,
        width: size
      }),
    [size]
  )

  return (
    <View style={containerStyle}>
      <Animated.View style={[dotStyle, animatedStyles1]} />
      <Animated.View style={[dotStyle, animatedStyles2]} />
      <Animated.View style={[dotStyle, animatedStyles3]} />
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
