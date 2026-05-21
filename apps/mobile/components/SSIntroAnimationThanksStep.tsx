import { Image as ExpoImage, type ImageSource } from 'expo-image'
import { useEffect, useMemo } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated'

import { Colors, Typography } from '@/styles'

const SUN_FONT_SIZE = 16
const SUN_LETTER_SPACING = 3.4
const SUN_LINE_HEIGHT = 14

const THANKS_SUN_REVEAL_MS = 520
const THANKS_ORBIT_REVEAL_MS = 420
const THANKS_NODE_STAGGER_MS = 70
const THANKS_NODE_REVEAL_MS = 320
const THANKS_BREATHE_MAX = 1.03
const THANKS_BREATHE_MS = 3600

/** Orbit band count (more rings + mixed node types). */
const ORBIT_BAND_COUNT = 6

/**
 * Base period per band (ms for one full turn). Outer bands slower; values
 * get small deterministic jitter in the effect.
 */
const ORBIT_PERIOD_BASE_MS: readonly number[] = [
  56000, 68000, 80000, 94000, 108000, 124000
]

const ORBIT_RING_COLOR_INNER = Colors.gray[300]
const ORBIT_RING_COLOR_OUTER = Colors.gray[800]

function lerpHex(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return {
      b: parseInt(h.slice(4, 6), 16),
      g: parseInt(h.slice(2, 4), 16),
      r: parseInt(h.slice(0, 2), 16)
    }
  }
  const a = parse(from)
  const b = parse(to)
  const channel = (start: number, end: number) =>
    Math.round(start + (end - start) * t)
  const r = channel(a.r, b.r)
  const g = channel(a.g, b.g)
  const bl = channel(a.b, b.b)
  return `#${[r, g, bl]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
}

function orbitRingColorForBand(band: number): string {
  const t =
    ORBIT_BAND_COUNT > 1 ? band / (ORBIT_BAND_COUNT - 1) : 0
  return lerpHex(ORBIT_RING_COLOR_INNER, ORBIT_RING_COLOR_OUTER, t)
}

function orbitRingOpacityForBand(band: number): number {
  const t =
    ORBIT_BAND_COUNT > 1 ? band / (ORBIT_BAND_COUNT - 1) : 0
  return 0.38 + t * 0.52
}

/**
 * Stable pseudo-random in [0, 1) from string (no Math.random in render).
 */
function hash01(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  return (h % 10000) / 10000
}

const OPENSATS_LOGO = require('@/assets/images/intro/opensats-avatar.png')
const BTC_LOGO = require('@/assets/images/intro/btc-logo.png')

const BTC_LOGO_SCALE = 0.8

type OrbitBandIndex = 0 | 1 | 2 | 3 | 4 | 5

type OrbitNodeInput = {
  band: OrbitBandIndex
  github?: string
  isCompany?: boolean
  logo?: ImageSource
  logoScale?: number
  size: number
}

type OrbitNodeSpec = OrbitNodeInput & {
  angle: number
}

/**
 * All thanks nodes: contributors and logos mixed across bands. Sizes match
 * the previous inner / middle / outer circles (unchanged pixel diameters).
 */
const ORBIT_NODE_INPUTS: readonly OrbitNodeInput[] = [
  { band: 0, github: 'dergigi', size: 22 },
  { band: 1, github: 'Yi-Jacob', size: 26 },
  { band: 1, github: 'francismars', size: 26 },
  { band: 2, github: 'umarluqman', size: 28 },
  { band: 2, github: 'Jeezman', size: 32 },
  { band: 2, github: 'NerdNook-rgb', size: 36 },
  { band: 3, github: 'garyray-k', size: 28 },
  { band: 3, github: 'tmakerman', size: 42 },
  { band: 3, isCompany: true, logo: OPENSATS_LOGO, size: 78 },
  { band: 4, github: 'pedromvpg', size: 54 },
  { band: 4, github: 'v4v2', size: 55 },
  {
    band: 5,
    isCompany: true,
    logo: BTC_LOGO,
    logoScale: BTC_LOGO_SCALE,
    size: 78
  },
  { band: 5, github: 'psycarlo', size: 56 }
]

/** Even spacing per band + random phase and per-node jitter (new each call). */
function buildOrbitNodesWithRandomAngles(
  specs: readonly OrbitNodeInput[]
): OrbitNodeSpec[] {
  const perBandCount = new Array<number>(ORBIT_BAND_COUNT).fill(0)
  const perBandIndex = new Array<number>(ORBIT_BAND_COUNT).fill(0)
  const bandPhase = Array.from(
    { length: ORBIT_BAND_COUNT },
    () => Math.random() * 360
  )

  for (const spec of specs) {
    perBandCount[spec.band] += 1
  }

  return specs.map((spec) => {
    const band = spec.band
    const count = perBandCount[band]
    const index = perBandIndex[band]
    perBandIndex[band] += 1

    const phase = bandPhase[band]
    const slot = count > 0 ? (360 / count) * index : 0
    const jitterSpan = count > 0 ? (360 / count) * 0.72 : 0
    const jitter = (Math.random() - 0.5) * jitterSpan
    const angle = (phase + slot + jitter + 360) % 360

    return { ...spec, angle }
  })
}

const TOTAL_NODE_COUNT = ORBIT_NODE_INPUTS.length

function orbitRadiiFromSafeWidth(safeWidth: number): number[] {
  const fractions = [0.185, 0.23, 0.28, 0.33, 0.375, 0.43]
  return fractions.map((f) => Math.round(safeWidth * f))
}

function orbitPeriodWithJitterMs(band: number): number {
  const base = ORBIT_PERIOD_BASE_MS[band] ?? ORBIT_PERIOD_BASE_MS[0]
  const jitter = 0.88 + hash01(`orbit-period-${band}`) * 0.22
  return Math.round(base * jitter)
}

function orbitDirectionSign(band: number): 1 | -1 {
  return hash01(`orbit-dir-${band}`) >= 0.5 ? 1 : -1
}

type PlanetNodeProps = {
  angle: number
  breathe: SharedValue<number>
  centerX: number
  centerY: number
  finaleProgress: SharedValue<number>
  github?: string
  isCompany?: boolean
  logo?: ImageSource
  logoScale?: number
  nodeReveal: SharedValue<number>
  orbitRadius: number
  orbitRotation: SharedValue<number>
  revealIndex: number
  size: number
}

function PlanetNode({
  angle,
  breathe,
  centerX,
  centerY,
  finaleProgress,
  github,
  isCompany,
  logo,
  logoScale,
  nodeReveal,
  orbitRadius,
  orbitRotation,
  revealIndex,
  size
}: PlanetNodeProps) {
  const animStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, nodeReveal.value - revealIndex))
    const progress = raw * raw * (3 - 2 * raw)
    const angleRad = ((angle + orbitRotation.value) * Math.PI) / 180
    const tx = orbitRadius * Math.sin(angleRad)
    const ty = -orbitRadius * Math.cos(angleRad)
    return {
      opacity: progress * (1 - finaleProgress.value),
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale: (0.4 + progress * 0.6) * breathe.value }
      ]
    }
  })

  return (
    <Animated.View
      style={[
        isCompany ? styles.companyPlanet : styles.contribPlanet,
        animStyle,
        {
          borderRadius: size / 2,
          height: size,
          left: centerX - size / 2,
          overflow: github || logo ? 'hidden' : 'visible',
          top: centerY - size / 2,
          width: size
        }
      ]}
    >
      {github ? (
        <Image
          source={{ uri: `https://github.com/${github}.png?size=120` }}
          style={{ height: size, width: size }}
        />
      ) : logo ? (
        <ExpoImage
          contentFit="contain"
          contentPosition="center"
          source={logo}
          style={{
            height: size * (logoScale ?? 1),
            width: size * (logoScale ?? 1)
          }}
        />
      ) : null}
    </Animated.View>
  )
}

type OrbitRingProps = {
  borderColor: string
  centerX: number
  centerY: number
  finaleProgress: SharedValue<number>
  opacity: SharedValue<number>
  radius: number
  targetOpacity: number
}

function OrbitRing({
  borderColor,
  centerX,
  centerY,
  finaleProgress,
  opacity,
  radius,
  targetOpacity
}: OrbitRingProps) {
  const ringStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * targetOpacity * (1 - finaleProgress.value)
  }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orbitRing,
        ringStyle,
        {
          borderColor,
          borderRadius: radius,
          height: radius * 2,
          left: centerX - radius,
          top: centerY - radius,
          width: radius * 2
        }
      ]}
    />
  )
}

type SSIntroAnimationThanksStepProps = {
  finaleProgress: SharedValue<number>
  screenHeight: number
  screenWidth: number
}

function SSIntroAnimationThanksStep({
  screenWidth,
  screenHeight,
  finaleProgress
}: SSIntroAnimationThanksStepProps) {
  const sunReveal = useSharedValue(0)
  const orbitOpacity = useSharedValue(0)
  const nodeReveal = useSharedValue(0)
  const breathe = useSharedValue(1)
  const orbitR0 = useSharedValue(0)
  const orbitR1 = useSharedValue(0)
  const orbitR2 = useSharedValue(0)
  const orbitR3 = useSharedValue(0)
  const orbitR4 = useSharedValue(0)
  const orbitR5 = useSharedValue(0)
  const orbitRotations = [
    orbitR0,
    orbitR1,
    orbitR2,
    orbitR3,
    orbitR4,
    orbitR5
  ]

  const orbitNodes = useMemo(
    () => buildOrbitNodesWithRandomAngles(ORBIT_NODE_INPUTS),
    []
  )

  const layout = useMemo(() => {
    // Clamp width so very wide screens (tablets) don't blow the orbit out.
    const safeWidth = Math.min(screenWidth, 460)
    const sunSize = Math.round(safeWidth * 0.24)
    const orbitRadii = orbitRadiiFromSafeWidth(safeWidth)
    const centerX = screenWidth / 2
    const centerY = screenHeight * 0.32
    return {
      centerX,
      centerY,
      orbitRadii,
      sunSize
    }
  }, [screenHeight, screenWidth])

  const sunStyle = useAnimatedStyle(() => ({
    opacity: sunReveal.value,
    transform: [
      {
        scale:
          (0.6 + sunReveal.value * 0.4) * (1 + finaleProgress.value * 0.06)
      }
    ]
  }))

  useEffect(() => {
    sunReveal.set(
      withTiming(
        1,
        {
          duration: THANKS_SUN_REVEAL_MS,
          easing: Easing.out(Easing.back(1.2))
        },
        () => {
          orbitOpacity.set(
            withTiming(1, {
              duration: THANKS_ORBIT_REVEAL_MS,
              easing: Easing.out(Easing.quad)
            })
          )
          nodeReveal.set(
            withTiming(
              TOTAL_NODE_COUNT,
              {
                duration:
                  TOTAL_NODE_COUNT * THANKS_NODE_STAGGER_MS +
                  THANKS_NODE_REVEAL_MS,
                easing: Easing.linear
              },
              () => {
                breathe.set(
                  withRepeat(
                    withTiming(THANKS_BREATHE_MAX, {
                      duration: THANKS_BREATHE_MS,
                      easing: Easing.inOut(Easing.sin)
                    }),
                    -1,
                    true
                  )
                )
              }
            )
          )
        }
      )
    )

    for (let b = 0; b < ORBIT_BAND_COUNT; b++) {
      const sign = orbitDirectionSign(b)
      orbitRotations[b].set(
        withRepeat(
          withTiming(sign * 360, {
            duration: orbitPeriodWithJitterMs(b),
            easing: Easing.linear
          }),
          -1,
          false
        )
      )
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { centerX, centerY, orbitRadii, sunSize } = layout

  const orbitNodesByZ = useMemo(
    () =>
      orbitNodes
        .map((node, revealIndex) => ({ node, revealIndex }))
        .sort((a, b) => b.node.size - a.node.size),
    [orbitNodes]
  )

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {orbitRadii.map((radius, band) => (
        <OrbitRing
          key={`ring-${band}`}
          borderColor={orbitRingColorForBand(band)}
          centerX={centerX}
          centerY={centerY}
          finaleProgress={finaleProgress}
          opacity={orbitOpacity}
          radius={radius}
          targetOpacity={orbitRingOpacityForBand(band)}
        />
      ))}

      {orbitNodesByZ.map(({ node, revealIndex }) => (
        <PlanetNode
          key={`orbit-${revealIndex}-${node.band}-${node.angle}`}
          angle={node.angle}
          breathe={breathe}
          centerX={centerX}
          centerY={centerY}
          finaleProgress={finaleProgress}
          github={node.github}
          isCompany={node.isCompany}
          logo={node.logo}
          logoScale={node.logoScale}
          nodeReveal={nodeReveal}
          orbitRadius={orbitRadii[node.band]}
          orbitRotation={orbitRotations[node.band]}
          revealIndex={revealIndex}
          size={node.size}
        />
      ))}

      <Animated.View
        style={[
          styles.sunWrapper,
          sunStyle,
          {
            left: centerX - sunSize / 2,
            top: centerY - sunSize / 2
          }
        ]}
      >
        <View
          style={[
            styles.sunCircle,
            {
              borderRadius: sunSize / 2,
              height: sunSize,
              width: sunSize
            }
          ]}
        >
          <Text style={styles.sunText}>{'SAT\nSIGNER'}</Text>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  companyPlanet: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderColor: Colors.gray[600],
    borderWidth: 2,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute'
  },
  contribPlanet: {
    borderColor: Colors.gray[500],
    borderWidth: 1.5,
    position: 'absolute'
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject
  },
  orbitRing: {
    borderWidth: 1,
    position: 'absolute'
  },
  sunCircle: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    justifyContent: 'center'
  },
  sunText: {
    color: Colors.black,
    fontFamily: Typography.sfProTextMedium,
    fontSize: SUN_FONT_SIZE,
    letterSpacing: SUN_LETTER_SPACING,
    lineHeight: SUN_LINE_HEIGHT,
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  sunWrapper: {
    position: 'absolute'
  }
})

export default SSIntroAnimationThanksStep
