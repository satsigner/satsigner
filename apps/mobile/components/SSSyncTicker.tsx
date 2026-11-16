import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  SlideInRight,
  SlideOutLeft
} from 'react-native-reanimated'

import useSyncLabelTicker from '@/hooks/useSyncLabelTicker'

import SSText from './SSText'

const TICKER_TRANSITION_MS = 450
// Fixed so the loader beside the ticker stays put as labels change length.
const TICKER_WIDTH = 160

const entering = SlideInRight.duration(TICKER_TRANSITION_MS).easing(
  Easing.out(Easing.cubic)
)
const exiting = SlideOutLeft.duration(TICKER_TRANSITION_MS).easing(
  Easing.in(Easing.cubic)
)

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
        entering={entering}
        exiting={exiting}
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
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  window: {
    height: 18,
    overflow: 'hidden',
    width: TICKER_WIDTH
  }
})

export default SSSyncTicker
