import { useEffect, useId } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Stop
} from 'react-native-svg'

import { Colors } from '@/styles'

const { gray, white } = Colors
const { 50: G50, 200: CHECK_GREY } = gray

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)

const VIEW_SIZE = 160
const VIEW_PAD_FILLED = 44
const VIEW_EXTENT_FILLED = VIEW_SIZE + 2 * VIEW_PAD_FILLED
const VIEW_BOX_FILLED = `${-VIEW_PAD_FILLED} ${-VIEW_PAD_FILLED} ${VIEW_EXTENT_FILLED} ${VIEW_EXTENT_FILLED}`
const VIEW_PAD_FILLED_LEGACY = 38
const VIEW_EXTENT_FILLED_LEGACY = VIEW_SIZE + 2 * VIEW_PAD_FILLED_LEGACY

const CX = 80
const CY = 80
const RING_R = 72
const RING_STROKE_FILLED = 1.2
const CHECK_STROKE_FILLED = 1.55
const OUTER_HALO_GRADIENT_R = 152
const HALO_R_MIN = 104
const HALO_R_MAX = 118
const INNER_DISC_R = RING_R
const BROADCAST_BODY_SCALE_LEGACY = 102 / 72
const BROADCAST_BODY_SCALE = 88 / 72
const BROADCAST_BODY_TRANSFORM = `translate(${CX} ${CY}) scale(${BROADCAST_BODY_SCALE}) translate(${-CX} ${-CY})`

const RING_OUTER_USER_LEGACY =
  RING_R * BROADCAST_BODY_SCALE_LEGACY + RING_STROKE_FILLED / 2
const RING_OUTER_USER_NOW =
  RING_R * BROADCAST_BODY_SCALE + RING_STROKE_FILLED / 2
const BROADCAST_RENDER_UPSCALE =
  (RING_OUTER_USER_LEGACY / RING_OUTER_USER_NOW) *
  (VIEW_EXTENT_FILLED / VIEW_EXTENT_FILLED_LEGACY)

const GLOW_CYCLE_MS = 3600
const HALO_OPACITY_MIN = 0.44
const HALO_OPACITY_MAX = 0.76
const INNER_GLOW_OPACITY_MIN = 0.94
const INNER_GLOW_OPACITY_MAX = 1
const SCALE_BREATHE_AMPLITUDE = 0.038
const RING_PULSE_STROKE_OPACITY_MIN = 0.52
const RING_PULSE_STROKE_OPACITY_MAX = 1

const CHECK_PATH = 'M44 81 L69 106 L116 52'
const CHECK_PATH_LENGTH = 107
const CHECK_DELAY_MS = 220
const CHECK_DRAW_MS = 420

const PULSE_RING_DELAY_MS = 250
const PULSE_RING_STAGGER_MS = 220
const PULSE_RING_DURATION_MS = 1000
const PULSE_RING_MAX_SCALE = 1.9
const PULSE_RING_START_OPACITY = 0.28

const DEFAULT_SIZE = 159

function smoothBreath(phaseRad: number): number {
  'worklet'
  const u = 0.5 + 0.5 * Math.sin(phaseRad)
  return u * u * (3 - 2 * u)
}

function SuccessPulseRing({ delay, size }: { delay: number; size: number }) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: PULSE_RING_DURATION_MS,
        easing: Easing.out(Easing.quad)
      })
    )
  }, [delay, progress])

  const ringStyle = useAnimatedStyle(() => ({
    opacity: PULSE_RING_START_OPACITY * (1 - progress.value),
    transform: [{ scale: 1 + (PULSE_RING_MAX_SCALE - 1) * progress.value }]
  }))

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          borderRadius: size / 2,
          height: size,
          left: '50%',
          marginLeft: -size / 2,
          marginTop: -size / 2,
          top: '50%',
          width: size
        },
        ringStyle
      ]}
    />
  )
}

type SSSuccessCheckAnimationProps = {
  height?: number
  width?: number
}

function SSSuccessCheckAnimation({
  height,
  width
}: SSSuccessCheckAnimationProps) {
  const gradientId = useId().replace(/:/g, '')
  const outerGlowId = `ssSuccessOuterGlow-${gradientId}`
  const discFillId = `ssSuccessDiscFill-${gradientId}`
  const volumeShadeId = `ssSuccessVolumeShade-${gradientId}`
  const volumeHighlightId = `ssSuccessVolumeHighlight-${gradientId}`

  const frameW = width ?? DEFAULT_SIZE
  const frameH = height ?? frameW
  const renderW = frameW * BROADCAST_RENDER_UPSCALE
  const renderH = frameH * BROADCAST_RENDER_UPSCALE
  const ringSize = Math.min(renderW, renderH) * 0.72

  const phase = useSharedValue(0)
  const checkOffset = useSharedValue(CHECK_PATH_LENGTH)

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: GLOW_CYCLE_MS,
        easing: Easing.linear
      }),
      -1,
      false
    )
    checkOffset.value = withDelay(
      CHECK_DELAY_MS,
      withTiming(0, {
        duration: CHECK_DRAW_MS,
        easing: Easing.out(Easing.quad)
      })
    )
  }, [checkOffset, phase])

  const pulseContainerStyle = useAnimatedStyle(() => {
    'worklet'
    const w = smoothBreath(phase.value)
    return {
      transform: [{ scale: 1 + SCALE_BREATHE_AMPLITUDE * w }]
    }
  })

  const haloAnimatedProps = useAnimatedProps(() => {
    'worklet'
    const w = smoothBreath(phase.value)
    const o = HALO_OPACITY_MIN + (HALO_OPACITY_MAX - HALO_OPACITY_MIN) * w
    const r = HALO_R_MIN + (HALO_R_MAX - HALO_R_MIN) * w
    return {
      fillOpacity: o,
      opacity: o,
      r
    }
  })

  const ringAnimatedProps = useAnimatedProps(() => {
    'worklet'
    const w = smoothBreath(phase.value)
    const lo = RING_PULSE_STROKE_OPACITY_MIN
    const hi = RING_PULSE_STROKE_OPACITY_MAX
    return { strokeOpacity: lo + (hi - lo) * w }
  })

  const innerGlowAnimatedProps = useAnimatedProps(() => {
    'worklet'
    const w = smoothBreath(phase.value)
    const o =
      INNER_GLOW_OPACITY_MIN +
      (INNER_GLOW_OPACITY_MAX - INNER_GLOW_OPACITY_MIN) * w
    return {
      fillOpacity: o,
      opacity: o
    }
  })

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: checkOffset.value
  }))

  return (
    <View style={[styles.container, { height: renderH, width: renderW }]}>
      <SuccessPulseRing delay={PULSE_RING_DELAY_MS} size={ringSize} />
      <SuccessPulseRing
        delay={PULSE_RING_DELAY_MS + PULSE_RING_STAGGER_MS}
        size={ringSize}
      />
      <Animated.View
        style={[
          styles.iconBody,
          { height: renderH, width: renderW },
          pulseContainerStyle
        ]}
      >
        <Svg
          width={renderW}
          height={renderH}
          viewBox={VIEW_BOX_FILLED}
          fill="none"
        >
          <Defs>
            <RadialGradient
              id={outerGlowId}
              cx={CX}
              cy={CY}
              fx={CX}
              fy={CY}
              gradientUnits="userSpaceOnUse"
              r={OUTER_HALO_GRADIENT_R}
            >
              <Stop offset="0%" stopColor={white} stopOpacity={0} />
              <Stop offset="48%" stopColor={white} stopOpacity={0} />
              <Stop offset="62%" stopColor={white} stopOpacity={0.045} />
              <Stop offset="74%" stopColor={white} stopOpacity={0.075} />
              <Stop offset="84%" stopColor={white} stopOpacity={0.09} />
              <Stop offset="93%" stopColor={white} stopOpacity={0.065} />
              <Stop offset="100%" stopColor={white} stopOpacity={0} />
            </RadialGradient>

            <RadialGradient
              id={discFillId}
              cx="50%"
              cy="50%"
              gradientUnits="objectBoundingBox"
              r="50%"
            >
              <Stop offset="0%" stopColor={white} stopOpacity={1} />
              <Stop offset="24%" stopColor={white} stopOpacity={0.98} />
              <Stop offset="48%" stopColor={white} stopOpacity={0.95} />
              <Stop offset="72%" stopColor={white} stopOpacity={0.9} />
              <Stop offset="100%" stopColor={white} stopOpacity={0.84} />
            </RadialGradient>

            <RadialGradient
              id={volumeShadeId}
              cx="50%"
              cy="52%"
              fx="50%"
              fy="58%"
              gradientUnits="objectBoundingBox"
              r="52%"
            >
              <Stop offset="0%" stopColor={white} stopOpacity={0} />
              <Stop offset="48%" stopColor={white} stopOpacity={0.012} />
              <Stop offset="78%" stopColor={G50} stopOpacity={0.018} />
              <Stop offset="100%" stopColor={G50} stopOpacity={0.01} />
            </RadialGradient>

            <RadialGradient
              id={volumeHighlightId}
              cx="50%"
              cy="48%"
              fx="46%"
              fy="38%"
              gradientUnits="objectBoundingBox"
              r="48%"
            >
              <Stop offset="0%" stopColor={white} stopOpacity={0.42} />
              <Stop offset="32%" stopColor={white} stopOpacity={0.1} />
              <Stop offset="62%" stopColor={white} stopOpacity={0.04} />
              <Stop offset="100%" stopColor={white} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          <AnimatedCircle
            animatedProps={haloAnimatedProps}
            cx={CX}
            cy={CY}
            fill={`url(#${outerGlowId})`}
          />

          <G transform={BROADCAST_BODY_TRANSFORM}>
            <AnimatedCircle
              animatedProps={innerGlowAnimatedProps}
              cx={CX}
              cy={CY}
              fill={`url(#${discFillId})`}
              r={INNER_DISC_R}
            />
            <AnimatedCircle
              animatedProps={innerGlowAnimatedProps}
              cx={CX}
              cy={CY}
              fill={`url(#${volumeShadeId})`}
              r={INNER_DISC_R}
            />
            <AnimatedCircle
              animatedProps={innerGlowAnimatedProps}
              cx={CX}
              cy={CY}
              fill={`url(#${volumeHighlightId})`}
              r={INNER_DISC_R}
            />

            <AnimatedCircle
              animatedProps={ringAnimatedProps}
              cx={CX}
              cy={CY}
              r={RING_R}
              fill="none"
              stroke={white}
              strokeWidth={RING_STROKE_FILLED}
            />

            <AnimatedPath
              d={CHECK_PATH}
              fill="none"
              stroke={CHECK_GREY}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.88}
              strokeWidth={CHECK_STROKE_FILLED}
              strokeDasharray={CHECK_PATH_LENGTH}
              animatedProps={checkProps}
            />
          </G>
        </Svg>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible'
  },
  iconBody: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible'
  },
  pulseRing: {
    borderColor: white,
    borderWidth: 1,
    position: 'absolute'
  }
})

export default SSSuccessCheckAnimation
