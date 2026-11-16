import { type LayoutChangeEvent, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'

import { SYNC_LABEL_TICK_MS } from '@/constants/sync'

import SSText from './SSText'

const MARQUEE_SCROLL_MS = 4000
const MARQUEE_SEPARATOR = ' – '
const TICKER_HEIGHT = 18

type SSSyncTickerProps = {
  labels: string[]
}

function SSSyncTicker({ labels }: SSSyncTickerProps) {
  const leadWidth = useSharedValue(0)
  const interludeWidth = useSharedValue(0)
  const progress = useSharedValue(0)

  const windowStyle = useAnimatedStyle(() =>
    leadWidth.value > 0 ? { width: leadWidth.value } : {}
  )
  const trackStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: -progress.value * (leadWidth.value + interludeWidth.value)
      }
    ]
  }))

  const [lead = '', ...rest] = labels
  if (rest.length === 0) {
    return (
      <View style={styles.window}>
        <SSText color="muted" size="xs" center numberOfLines={1}>
          {lead}
        </SSText>
      </View>
    )
  }

  const interlude = `${MARQUEE_SEPARATOR}${rest.join(MARQUEE_SEPARATOR)}${MARQUEE_SEPARATOR}`

  // The lead label holds still, the track scrolls through the interlude, and
  // the second copy of the lead lands exactly where the first was, so the
  // jump back to the start is invisible. Animating a 0..1 progress lets the
  // lead change width (live counts) without restarting the scroll.
  function startLoop() {
    if (progress.value > 0) {
      return
    }
    progress.value = withRepeat(
      withSequence(
        withDelay(
          SYNC_LABEL_TICK_MS,
          withTiming(1, {
            duration: MARQUEE_SCROLL_MS,
            easing: Easing.inOut(Easing.quad)
          })
        ),
        withTiming(0, { duration: 0 })
      ),
      -1
    )
  }

  function handleLeadLayout(event: LayoutChangeEvent) {
    leadWidth.value = event.nativeEvent.layout.width
    startLoop()
  }

  function handleInterludeLayout(event: LayoutChangeEvent) {
    interludeWidth.value = event.nativeEvent.layout.width
  }

  return (
    <Animated.View style={[styles.window, windowStyle]}>
      <Animated.View style={[styles.track, trackStyle]}>
        <SSText
          color="muted"
          size="xs"
          style={styles.digits}
          onLayout={handleLeadLayout}
        >
          {lead}
        </SSText>
        <SSText color="muted" size="xs" onLayout={handleInterludeLayout}>
          {interlude}
        </SSText>
        <SSText color="muted" size="xs" style={styles.digits}>
          {lead}
        </SSText>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Equal-width digits keep the window steady as the counts tick up.
  digits: {
    fontVariant: ['tabular-nums']
  },
  track: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    top: 0
  },
  window: {
    alignItems: 'center',
    height: TICKER_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden'
  }
})

export default SSSyncTicker
