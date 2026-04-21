import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Stop,
  type SvgProps
} from 'react-native-svg'

import { Colors } from '@/styles'

const { gray } = Colors
const { 50: G50, 200: CHECK_GREY } = gray

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type IconProps = {
  variant?: 'filled' | 'outline'
} & Pick<SvgProps, 'width' | 'height' | 'fill'>

const VIEW_SIZE = 160
/** Outline: minimal pad around ring + soft rim (signed state). */
const VIEW_PAD_OUTLINE = 22
const VIEW_EXTENT_OUTLINE = VIEW_SIZE + 2 * VIEW_PAD_OUTLINE
const VIEW_BOX_OUTLINE = `${-VIEW_PAD_OUTLINE} ${-VIEW_PAD_OUTLINE} ${VIEW_EXTENT_OUTLINE} ${VIEW_EXTENT_OUTLINE}`

/**
 * Filled broadcast: pad clears max halo radius while pulsing (see haloAnimatedProps
 * `r`) and keeps margin for stroke AA.
 */
const VIEW_PAD_FILLED = 44
const VIEW_EXTENT_FILLED = VIEW_SIZE + 2 * VIEW_PAD_FILLED
const VIEW_BOX_FILLED = `${-VIEW_PAD_FILLED} ${-VIEW_PAD_FILLED} ${VIEW_EXTENT_FILLED} ${VIEW_EXTENT_FILLED}`
/** View padding before pad was widened for halo pulse (render upscale math). */
const VIEW_PAD_FILLED_LEGACY = 38
const VIEW_EXTENT_FILLED_LEGACY = VIEW_SIZE + 2 * VIEW_PAD_FILLED_LEGACY

const CX = 80
const CY = 80
const RING_R = 72

const RING_STROKE_OUTLINE = 1.2
const CHECK_STROKE_OUTLINE = 1.55
const STROKE_OPACITY_OUTLINE = 0.52
const INNER_GLOW_R_OUTLINE = 70

const RING_STROKE_FILLED = 1.2
const CHECK_STROKE_FILLED = 1.55
/**
 * Radial gradient radius (userSpaceOnUse). Large value = diffuse falloff; must
 * cover max animated halo `r` so the fill never clips when the glow swells.
 */
const OUTER_HALO_GRADIENT_R = 152
/** Halo circle radius range while pulsing (inside gradient extent). */
const HALO_R_MIN = 104
const HALO_R_MAX = 118
/** Match ring radius so fills meet the stroke */
const INNER_DISC_R = RING_R
/** Legacy broadcast body scale (reference ring size on screen). */
const BROADCAST_BODY_SCALE_LEGACY = 102 / 72
/**
 * Smaller body in viewBox than legacy; render upscale restores legacy ring size.
 */
const BROADCAST_BODY_SCALE = 88 / 72
const BROADCAST_BODY_TRANSFORM = `translate(${CX} ${CY}) scale(${BROADCAST_BODY_SCALE}) translate(${-CX} ${-CY})`

const RING_OUTER_USER_LEGACY =
  RING_R * BROADCAST_BODY_SCALE_LEGACY + RING_STROKE_FILLED / 2
const RING_OUTER_USER_NOW =
  RING_R * BROADCAST_BODY_SCALE + RING_STROKE_FILLED / 2
/** Width/height multiplier so the ring matches legacy size for the same props. */
const BROADCAST_RENDER_UPSCALE =
  (RING_OUTER_USER_LEGACY / RING_OUTER_USER_NOW) *
  (VIEW_EXTENT_FILLED / VIEW_EXTENT_FILLED_LEGACY)

/** Slower cycle reads calmer; linear phase keeps the loop seamless */
const GLOW_CYCLE_MS = 3600
/** Capped peak so the outer ring never reads as a harsh hot spot */
const HALO_OPACITY_MIN = 0.44
const HALO_OPACITY_MAX = 0.76
/** Subtle pulse only — low min was pulling the disc toward grey */
const INNER_GLOW_OPACITY_MIN = 0.94
const INNER_GLOW_OPACITY_MAX = 1
/** Whole-icon breathe on top of render upscale */
const SCALE_BREATHE_AMPLITUDE = 0.038
const RING_PULSE_STROKE_OPACITY_MIN = 0.52
const RING_PULSE_STROKE_OPACITY_MAX = 1

function smoothBreath(phaseRad: number): number {
  'worklet'
  const u = 0.5 + 0.5 * Math.sin(phaseRad)
  return u * u * (3 - 2 * u)
}

const WHITE = '#FFFFFF'

type SizeProps = Pick<IconProps, 'width' | 'height'>

function BroadcastFilledIcon({ height, width }: SizeProps) {
  const phase = useSharedValue(0)
  const frameW = Number(width) || VIEW_EXTENT_FILLED
  const frameH = Number(height) || frameW
  const renderW = frameW * BROADCAST_RENDER_UPSCALE
  const renderH = frameH * BROADCAST_RENDER_UPSCALE

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: GLOW_CYCLE_MS,
        easing: Easing.linear
      }),
      -1,
      false
    )
  }, [phase])

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

  return (
    <Animated.View
      style={[
        {
          alignItems: 'center',
          height: renderH,
          justifyContent: 'center',
          overflow: 'visible',
          width: renderW
        },
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
            id="ssIconBroadcastOuterGlow"
            cx={CX}
            cy={CY}
            fx={CX}
            fy={CY}
            gradientUnits="userSpaceOnUse"
            r={OUTER_HALO_GRADIENT_R}
          >
            <Stop offset="0%" stopColor={WHITE} stopOpacity={0} />
            <Stop offset="48%" stopColor={WHITE} stopOpacity={0} />
            <Stop offset="62%" stopColor={WHITE} stopOpacity={0.045} />
            <Stop offset="74%" stopColor={WHITE} stopOpacity={0.075} />
            <Stop offset="84%" stopColor={WHITE} stopOpacity={0.09} />
            <Stop offset="93%" stopColor={WHITE} stopOpacity={0.065} />
            <Stop offset="100%" stopColor={WHITE} stopOpacity={0} />
          </RadialGradient>

          <RadialGradient
            id="ssIconBroadcastDiscFill"
            cx="50%"
            cy="50%"
            gradientUnits="objectBoundingBox"
            r="50%"
          >
            <Stop offset="0%" stopColor={WHITE} stopOpacity={1} />
            <Stop offset="24%" stopColor={WHITE} stopOpacity={0.98} />
            <Stop offset="48%" stopColor={WHITE} stopOpacity={0.95} />
            <Stop offset="72%" stopColor={WHITE} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={WHITE} stopOpacity={0.84} />
          </RadialGradient>

          <RadialGradient
            id="ssIconBroadcastVolumeShade"
            cx="50%"
            cy="52%"
            fx="50%"
            fy="58%"
            gradientUnits="objectBoundingBox"
            r="52%"
          >
            <Stop offset="0%" stopColor={WHITE} stopOpacity={0} />
            <Stop offset="48%" stopColor={WHITE} stopOpacity={0.012} />
            <Stop offset="78%" stopColor={G50} stopOpacity={0.018} />
            <Stop offset="100%" stopColor={G50} stopOpacity={0.01} />
          </RadialGradient>

          <RadialGradient
            id="ssIconBroadcastVolumeHighlight"
            cx="50%"
            cy="48%"
            fx="46%"
            fy="38%"
            gradientUnits="objectBoundingBox"
            r="48%"
          >
            <Stop offset="0%" stopColor={WHITE} stopOpacity={0.42} />
            <Stop offset="32%" stopColor={WHITE} stopOpacity={0.1} />
            <Stop offset="62%" stopColor={WHITE} stopOpacity={0.04} />
            <Stop offset="100%" stopColor={WHITE} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <AnimatedCircle
          animatedProps={haloAnimatedProps}
          cx={CX}
          cy={CY}
          fill="url(#ssIconBroadcastOuterGlow)"
        />

        <G transform={BROADCAST_BODY_TRANSFORM}>
          <AnimatedCircle
            animatedProps={innerGlowAnimatedProps}
            cx={CX}
            cy={CY}
            fill="url(#ssIconBroadcastDiscFill)"
            r={INNER_DISC_R}
          />
          <AnimatedCircle
            animatedProps={innerGlowAnimatedProps}
            cx={CX}
            cy={CY}
            fill="url(#ssIconBroadcastVolumeShade)"
            r={INNER_DISC_R}
          />
          <AnimatedCircle
            animatedProps={innerGlowAnimatedProps}
            cx={CX}
            cy={CY}
            fill="url(#ssIconBroadcastVolumeHighlight)"
            r={INNER_DISC_R}
          />

          <AnimatedCircle
            animatedProps={ringAnimatedProps}
            cx={CX}
            cy={CY}
            r={RING_R}
            fill="none"
            stroke={WHITE}
            strokeWidth={RING_STROKE_FILLED}
          />

          <Path
            d="M44 81 L69 106 L116 52"
            stroke={CHECK_GREY}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.88}
            strokeWidth={CHECK_STROKE_FILLED}
          />
        </G>
      </Svg>
    </Animated.View>
  )
}

export default function SSIconSuccess({
  variant = 'filled',
  width,
  height
}: IconProps) {
  const isFilled = variant === 'filled'

  if (!isFilled) {
    return (
      <Svg width={width} height={height} viewBox={VIEW_BOX_OUTLINE} fill="none">
        <Defs>
          <RadialGradient
            id="ssIconSignedRim"
            cx="50%"
            cy="50%"
            gradientUnits="objectBoundingBox"
            r="50%"
          >
            <Stop offset="0%" stopColor={WHITE} stopOpacity={0} />
            <Stop offset="48%" stopColor={WHITE} stopOpacity={0} />
            <Stop offset="72%" stopColor={WHITE} stopOpacity={0.05} />
            <Stop offset="88%" stopColor={WHITE} stopOpacity={0.11} />
            <Stop offset="100%" stopColor={WHITE} stopOpacity={0.15} />
          </RadialGradient>
          <RadialGradient
            id="ssIconSignedCenter"
            cx="50%"
            cy="50%"
            gradientUnits="objectBoundingBox"
            r="50%"
          >
            <Stop offset="0%" stopColor={WHITE} stopOpacity={0.14} />
            <Stop offset="38%" stopColor={WHITE} stopOpacity={0.05} />
            <Stop offset="100%" stopColor={WHITE} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Circle
          cx={CX}
          cy={CY}
          r={INNER_GLOW_R_OUTLINE}
          fill="url(#ssIconSignedRim)"
        />
        <Circle
          cx={CX}
          cy={CY}
          r={INNER_GLOW_R_OUTLINE}
          fill="url(#ssIconSignedCenter)"
        />

        <Circle
          cx={CX}
          cy={CY}
          r={RING_R}
          fill="none"
          stroke={WHITE}
          strokeOpacity={STROKE_OPACITY_OUTLINE}
          strokeWidth={RING_STROKE_OUTLINE}
        />

        <Path
          d="M44 81 L69 106 L116 52"
          stroke={WHITE}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={STROKE_OPACITY_OUTLINE}
          strokeWidth={CHECK_STROKE_OUTLINE}
        />
      </Svg>
    )
  }

  return <BroadcastFilledIcon height={height} width={width} />
}
