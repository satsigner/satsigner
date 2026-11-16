import { type LayoutChangeEvent, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated'

import SSText from './SSText'

const MARQUEE_SPEED_PX_PER_SEC = 25
// The scroll distance grows for this long before restarting; the visible
// offset wraps every loop width, so the restart is invisible.
const MARQUEE_RUN_MS = 60 * 60_000
const MARQUEE_RUN_PX = (MARQUEE_RUN_MS / 1000) * MARQUEE_SPEED_PX_PER_SEC
const MARQUEE_SEPARATOR = '   ·   '
// Fixed so the loader beside the ticker stays put as labels change length.
const TICKER_WIDTH = 120
const TICKER_HEIGHT = 18

type SSSyncTickerProps = {
  labels: string[]
}

function SSSyncTicker({ labels }: SSSyncTickerProps) {
  const distance = useSharedValue(0)
  const loopWidth = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          loopWidth.value > 0 ? -(distance.value % loopWidth.value) : 0
      }
    ]
  }))

  if (labels.length < 2) {
    return (
      <View style={styles.window}>
        <SSText color="muted" size="xs" center numberOfLines={1}>
          {labels[0] ?? ''}
        </SSText>
      </View>
    )
  }

  const loopText = labels.join(MARQUEE_SEPARATOR) + MARQUEE_SEPARATOR

  // One copy of the text is one loop; the second copy fills the gap so the
  // wrap back to the start is invisible. Progress updates change the width,
  // so the scroll keeps running and only the wrap point moves.
  function handleLoopLayout(event: LayoutChangeEvent) {
    loopWidth.value = event.nativeEvent.layout.width
    if (distance.value > 0) {
      return
    }
    distance.value = withRepeat(
      withTiming(MARQUEE_RUN_PX, {
        duration: MARQUEE_RUN_MS,
        easing: Easing.linear
      }),
      -1
    )
  }

  return (
    <View style={styles.window}>
      <Animated.View style={[styles.track, animatedStyle]}>
        <SSText color="muted" size="xs" onLayout={handleLoopLayout}>
          {loopText}
        </SSText>
        <SSText color="muted" size="xs">
          {loopText}
        </SSText>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    position: 'absolute'
  },
  window: {
    height: TICKER_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
    width: TICKER_WIDTH
  }
})

export default SSSyncTicker
