import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated'

import useSyncLabelTicker from '@/hooks/useSyncLabelTicker'

import SSText from './SSText'

const TICKER_TRANSITION_MS = 250
const TICKER_TRAVEL_PX = 4

const entering = FadeInDown.duration(TICKER_TRANSITION_MS).withInitialValues({
  transform: [{ translateY: TICKER_TRAVEL_PX }]
})
const exiting = FadeOutUp.duration(TICKER_TRANSITION_MS)

type SSSyncTickerProps = {
  labels: string[]
}

function SSSyncTicker({ labels }: SSSyncTickerProps) {
  const index = useSyncLabelTicker(labels.length)
  const label = labels[index] ?? ''

  return (
    <Animated.View key={index} entering={entering} exiting={exiting}>
      <SSText color="muted" size="xs" center numberOfLines={1}>
        {label}
      </SSText>
    </Animated.View>
  )
}

export default SSSyncTicker
