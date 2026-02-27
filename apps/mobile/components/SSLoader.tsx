import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { Colors } from '@/styles'

const VIEWBOX_WIDTH = 120
const VIEWBOX_HEIGHT = 60
const R = 12
const ORBIT_CENTER_X = VIEWBOX_WIDTH / 2
const ORBIT_CENTER_Y = VIEWBOX_HEIGHT / 2
const ORBIT_RADIUS = 22
const DEPTH_SCALE = 0.85

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type SSLoaderProps = {
  size?: number
  color?: string
}

function SSLoader({ size = 80, color = Colors.white }: SSLoaderProps) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: 1500,
        easing: Easing.linear
      }),
      -1,
      false
    )
  }, [progress])

  const leftCircleProps = useAnimatedProps(() => {
    'worklet'
    const s = 1 - DEPTH_SCALE * Math.sin(progress.value)
    return {
      cx: ORBIT_CENTER_X + ORBIT_RADIUS * Math.cos(progress.value),
      cy: ORBIT_CENTER_Y - ORBIT_RADIUS * Math.sin(progress.value),
      r: R * s
    }
  })

  const rightCircleProps = useAnimatedProps(() => {
    'worklet'
    const s = 1 - DEPTH_SCALE * Math.sin(progress.value + Math.PI)
    return {
      cx: ORBIT_CENTER_X + ORBIT_RADIUS * Math.cos(progress.value + Math.PI),
      cy: ORBIT_CENTER_Y - ORBIT_RADIUS * Math.sin(progress.value + Math.PI),
      r: R * s
    }
  })

  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid"
      >
        <AnimatedCircle
          cx={ORBIT_CENTER_X + ORBIT_RADIUS}
          cy={ORBIT_CENTER_Y}
          r={R}
          fill={color}
          animatedProps={leftCircleProps}
        />
        <AnimatedCircle
          cx={ORBIT_CENTER_X - ORBIT_RADIUS}
          cy={ORBIT_CENTER_Y}
          r={R}
          fill={color}
          animatedProps={rightCircleProps}
        />
      </Svg>
    </View>
  )
}

export default SSLoader
