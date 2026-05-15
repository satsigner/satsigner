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

const SUN_FONT_SIZE = 18
const SUN_LETTER_SPACING = 3.4
const SUN_LINE_HEIGHT = 20

const THANKS_SUN_REVEAL_MS = 520
const THANKS_ORBIT_REVEAL_MS = 420
const THANKS_NODE_STAGGER_MS = 70
const THANKS_NODE_REVEAL_MS = 320
const THANKS_BREATHE_MAX = 1.03
const THANKS_BREATHE_MS = 3600

// Outer planets revolve slower than inner ones (Kepler-ish feel).
const ORBIT_INNER_PERIOD_MS = 70000
const ORBIT_MIDDLE_PERIOD_MS = 95000
const ORBIT_OUTER_PERIOD_MS = 130000

type Planet = {
  angle: number
  github: string
  size: number
}

// Inner orbit — top contributors by commit count, sized by importance.
const INNER_PLANETS: readonly Planet[] = [
  { angle: 0, github: 'psycarlo', size: 56 },
  { angle: 90, github: 'v4v2', size: 55 },
  { angle: 180, github: 'pedromvpg', size: 54 },
  { angle: 270, github: 'tmakerman', size: 42 }
]

// Middle orbit — supporting contributors. Angles deliberately offset from
// inner cardinal positions (0/90/180/270) so planets never sit on the same
// radial line as an inner planet.
const MIDDLE_PLANETS: readonly Planet[] = [
  { angle: 20, github: 'NerdNook-rgb', size: 36 },
  { angle: 108, github: 'Jeezman', size: 32 },
  { angle: 200, github: 'garyray-k', size: 28 },
  { angle: 252, github: 'francismars', size: 26 },
  { angle: 324, github: 'dergigi', size: 22 }
]

// Outer orbit — company circles. Largest planets, visual priority of the
// whole system (Jupiter/Saturn). Placed on a NE/SW diagonal so they don't
// stack horizontally with the inner planets at 90°/270°.
const OUTER_COMPANIES = [
  { angle: 60, size: 78 },
  { angle: 240, size: 78 }
] as const

const TOTAL_NODE_COUNT =
  INNER_PLANETS.length + MIDDLE_PLANETS.length + OUTER_COMPANIES.length

type PlanetNodeProps = {
  angle: number
  breathe: SharedValue<number>
  centerX: number
  centerY: number
  finaleProgress: SharedValue<number>
  github?: string
  isCompany?: boolean
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
          overflow: github ? 'hidden' : 'visible',
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
      ) : null}
    </Animated.View>
  )
}

type OrbitRingProps = {
  centerX: number
  centerY: number
  finaleProgress: SharedValue<number>
  opacity: SharedValue<number>
  radius: number
  targetOpacity: number
}

function OrbitRing({
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
  const orbitInnerRotation = useSharedValue(0)
  const orbitMiddleRotation = useSharedValue(0)
  const orbitOuterRotation = useSharedValue(0)

  const layout = useMemo(() => {
    // Clamp width so very wide screens (tablets) don't blow the orbit out.
    const safeWidth = Math.min(screenWidth, 460)
    const sunSize = Math.round(safeWidth * 0.24)
    const orbitOuter = Math.round(safeWidth * 0.43)
    const orbitMiddle = Math.round(safeWidth * 0.33)
    const orbitInner = Math.round(safeWidth * 0.22)
    const sunGlow = orbitInner * 2
    const centerX = screenWidth / 2
    const centerY = screenHeight * 0.32
    return {
      centerX,
      centerY,
      orbitInner,
      orbitMiddle,
      orbitOuter,
      sunGlow,
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

  const sunGlowStyle = useAnimatedStyle(() => ({
    opacity: sunReveal.value * 0.08 * (1 - finaleProgress.value),
    transform: [{ scale: 0.85 + breathe.value * 0.18 }]
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

    orbitInnerRotation.set(
      withRepeat(
        withTiming(360, {
          duration: ORBIT_INNER_PERIOD_MS,
          easing: Easing.linear
        }),
        -1,
        false
      )
    )
    orbitMiddleRotation.set(
      withRepeat(
        withTiming(-360, {
          duration: ORBIT_MIDDLE_PERIOD_MS,
          easing: Easing.linear
        }),
        -1,
        false
      )
    )
    orbitOuterRotation.set(
      withRepeat(
        withTiming(360, {
          duration: ORBIT_OUTER_PERIOD_MS,
          easing: Easing.linear
        }),
        -1,
        false
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const {
    centerX,
    centerY,
    orbitInner,
    orbitMiddle,
    orbitOuter,
    sunGlow,
    sunSize
  } = layout

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      <Animated.View
        style={[
          styles.sunGlow,
          sunGlowStyle,
          {
            borderRadius: sunGlow / 2,
            height: sunGlow,
            left: centerX - sunGlow / 2,
            top: centerY - sunGlow / 2,
            width: sunGlow
          }
        ]}
      />

      <OrbitRing
        centerX={centerX}
        centerY={centerY}
        finaleProgress={finaleProgress}
        opacity={orbitOpacity}
        radius={orbitInner}
        targetOpacity={0.06}
      />
      <OrbitRing
        centerX={centerX}
        centerY={centerY}
        finaleProgress={finaleProgress}
        opacity={orbitOpacity}
        radius={orbitMiddle}
        targetOpacity={0.05}
      />
      <OrbitRing
        centerX={centerX}
        centerY={centerY}
        finaleProgress={finaleProgress}
        opacity={orbitOpacity}
        radius={orbitOuter}
        targetOpacity={0.08}
      />

      {INNER_PLANETS.map((p, i) => (
        <PlanetNode
          key={`inner-${i}`}
          angle={p.angle}
          breathe={breathe}
          centerX={centerX}
          centerY={centerY}
          finaleProgress={finaleProgress}
          github={p.github}
          nodeReveal={nodeReveal}
          orbitRadius={orbitInner}
          orbitRotation={orbitInnerRotation}
          revealIndex={i}
          size={p.size}
        />
      ))}

      {MIDDLE_PLANETS.map((p, i) => (
        <PlanetNode
          key={`middle-${i}`}
          angle={p.angle}
          breathe={breathe}
          centerX={centerX}
          centerY={centerY}
          finaleProgress={finaleProgress}
          github={p.github}
          nodeReveal={nodeReveal}
          orbitRadius={orbitMiddle}
          orbitRotation={orbitMiddleRotation}
          revealIndex={INNER_PLANETS.length + i}
          size={p.size}
        />
      ))}

      {OUTER_COMPANIES.map((c, i) => (
        <PlanetNode
          key={`company-${i}`}
          angle={c.angle}
          breathe={breathe}
          centerX={centerX}
          centerY={centerY}
          finaleProgress={finaleProgress}
          isCompany
          nodeReveal={nodeReveal}
          orbitRadius={orbitOuter}
          orbitRotation={orbitOuterRotation}
          revealIndex={INNER_PLANETS.length + MIDDLE_PLANETS.length + i}
          size={c.size}
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: Colors.white,
    borderWidth: 1.5,
    position: 'absolute'
  },
  contribPlanet: {
    borderColor: Colors.white,
    borderWidth: 1,
    position: 'absolute'
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject
  },
  orbitRing: {
    borderColor: Colors.white,
    borderWidth: 1,
    position: 'absolute'
  },
  sunCircle: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    justifyContent: 'center'
  },
  sunGlow: {
    backgroundColor: Colors.white,
    position: 'absolute'
  },
  sunText: {
    color: Colors.black,
    fontFamily: Typography.sfProTextRegular,
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
