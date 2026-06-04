import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'

import SSSignSendSankeyIllustration from '@/components/SSSignSendSankeyIllustration'

const SANKEY_FADE_MS = 600
const SANKEY_SCALE_START = 0.88

type SSIntroAnimationSankeyStepProps = {
  screenHeight: number
}

function SSIntroAnimationSankeyStep({
  screenHeight
}: SSIntroAnimationSankeyStepProps) {
  const chartOpacity = useSharedValue(0)
  const chartScale = useSharedValue(SANKEY_SCALE_START)

  const chartStyle = useAnimatedStyle(() => ({
    opacity: chartOpacity.value,
    transform: [{ scale: chartScale.value }]
  }))

  useEffect(() => {
    chartOpacity.set(
      withTiming(1, {
        duration: SANKEY_FADE_MS,
        easing: Easing.out(Easing.cubic)
      })
    )
    chartScale.set(
      withTiming(1, {
        duration: SANKEY_FADE_MS,
        easing: Easing.out(Easing.cubic)
      })
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      <Animated.View
        style={[
          styles.fullScreen,
          {
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: screenHeight * 0.12
          },
          chartStyle
        ]}
      >
        <SSSignSendSankeyIllustration />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject
  }
})

export default SSIntroAnimationSankeyStep
