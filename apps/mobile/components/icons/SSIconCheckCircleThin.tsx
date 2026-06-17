import { useRef } from 'react'
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated'
import Svg, { Circle, G, Path, type SvgProps } from 'react-native-svg'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)

const CHECK_PATH_LENGTH = 22

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconCheckCircleThin({ width, height }: IconProps) {
  const circleOpacity = useSharedValue(0)
  const checkOffset = useSharedValue(CHECK_PATH_LENGTH)
  const started = useRef(false)

  if (!started.current) {
    started.current = true
    circleOpacity.value = withTiming(1, { duration: 350 })
    checkOffset.value = withDelay(150, withTiming(0, { duration: 400 }))
  }

  const circleProps = useAnimatedProps(() => ({
    opacity: circleOpacity.value
  }))

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: checkOffset.value
  }))

  return (
    <Svg width={width} height={height} viewBox="0 0 35 35">
      <G transform="translate(-0.5 -0.5)">
        <AnimatedCircle
          cx="17"
          cy="17"
          r="17"
          transform="translate(1 1)"
          fill="none"
          stroke="#fff"
          strokeWidth="1"
          animatedProps={circleProps}
        />
        <AnimatedPath
          d="M6.7,15.038l4.208,4.04L22.017,7.8"
          transform="translate(3.894 4.645)"
          fill="none"
          stroke="#fff"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_PATH_LENGTH}
          animatedProps={checkProps}
        />
      </G>
    </Svg>
  )
}
