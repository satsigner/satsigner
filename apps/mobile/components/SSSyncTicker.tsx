import { StyleSheet, View } from 'react-native'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'

import useSyncLabelTicker from '@/hooks/useSyncLabelTicker'

import SSText from './SSText'

const TICKER_TRANSITION_MS = 700
// Fixed so the loader beside the ticker stays put as labels change length.
const TICKER_WIDTH = 120
const TICKER_HEIGHT = 18

// Built-in slide animations travel the screen width, which is too fast to
// read through a window this narrow; these travel exactly one window.
const entering = new Keyframe({
  0: { transform: [{ translateX: TICKER_WIDTH }] },
  100: {
    easing: Easing.inOut(Easing.cubic),
    transform: [{ translateX: 0 }]
  }
}).duration(TICKER_TRANSITION_MS)

const exiting = new Keyframe({
  0: { transform: [{ translateX: 0 }] },
  100: {
    easing: Easing.inOut(Easing.cubic),
    transform: [{ translateX: -TICKER_WIDTH }]
  }
}).duration(TICKER_TRANSITION_MS)

type SSSyncTickerProps = {
  labels: string[]
}

function SSSyncTicker({ labels }: SSSyncTickerProps) {
  const index = useSyncLabelTicker(labels.length)
  const label = labels[index] ?? ''

  return (
    <View style={styles.window}>
      <Animated.View
        key={index}
        entering={labels.length > 1 ? entering : undefined}
        exiting={labels.length > 1 ? exiting : undefined}
        style={styles.label}
      >
        <SSText color="muted" size="xs" center numberOfLines={1}>
          {label}
        </SSText>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  window: {
    height: TICKER_HEIGHT,
    overflow: 'hidden',
    width: TICKER_WIDTH
  }
})

export default SSSyncTicker
