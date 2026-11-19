import { useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import type { LayoutChangeEvent } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
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

type SyncTickerMarqueeProps = {
  interlude: string
  lead: string
}

// The lead label holds still, the track scrolls through the interlude, and
// the second copy of the lead lands exactly where the first was, so the jump
// back to the start is invisible. Animating a 0..1 progress lets the lead
// change width (live counts) without restarting the scroll. Unmounting cancels
// the loop, so it only runs while there is more than one label.
function SyncTickerMarquee({ interlude, lead }: SyncTickerMarqueeProps) {
  const hasStartedLoop = useRef(false)
  const leadSize = useSharedValue({ height: 0, width: 0 })
  const loopOffset = useSharedValue(0)
  const progress = useSharedValue(0)

  // The track is absolutely positioned, so the window takes the lead's
  // measured size, which also follows the system font scale. Rounded up: a
  // window a fraction smaller than the text clips it.
  const windowStyle = useAnimatedStyle(() => {
    const { height, width } = leadSize.get()
    return width > 0
      ? { height: Math.ceil(height), width: Math.ceil(width) }
      : {}
  })
  const trackStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: -progress.get() * loopOffset.get()
      }
    ]
  }))

  function startLoop() {
    if (hasStartedLoop.current) {
      return
    }
    hasStartedLoop.current = true
    progress.set(
      withRepeat(
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
    )
  }

  function handleLeadLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout
    leadSize.set({ height, width })
    startLoop()
  }

  // Where the second copy actually starts, so the scroll lands on it exactly.
  function handleRepeatLayout(event: LayoutChangeEvent) {
    loopOffset.set(event.nativeEvent.layout.x)
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
        <SSText color="muted" size="xs">
          {interlude}
        </SSText>
        <SSText
          color="muted"
          size="xs"
          style={styles.digits}
          onLayout={handleRepeatLayout}
        >
          {lead}
        </SSText>
      </Animated.View>
    </Animated.View>
  )
}

function SSSyncTicker({ labels }: SSSyncTickerProps) {
  const reduceMotion = useReducedMotion()
  const [lead = '', ...rest] = labels
  // Reduce Motion ends the marquee before it scrolls, so show every label.
  if (rest.length === 0 || reduceMotion) {
    return (
      <View style={styles.window}>
        <SSText color="muted" size="xs" center numberOfLines={1}>
          {labels.join(MARQUEE_SEPARATOR)}
        </SSText>
      </View>
    )
  }

  const interlude = `${MARQUEE_SEPARATOR}${rest.join(MARQUEE_SEPARATOR)}${MARQUEE_SEPARATOR}`

  return <SyncTickerMarquee interlude={interlude} lead={lead} />
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
    justifyContent: 'center',
    minHeight: TICKER_HEIGHT,
    overflow: 'hidden'
  }
})

export default SSSyncTicker
