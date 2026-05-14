import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'

import { Colors } from '@/styles'

const PRIVACY_CENTER_Y_FRACTION = 0.38
const PRIVACY_STAGGER_MS = 88
const PRIVACY_REVEAL_MS = 400
const PRIVACY_FADE_STAGGER_MS = 158
const PRIVACY_FADE_MS = 660
const PRIVACY_FADE_OUT_OPACITY_EXP = 1.22
const PRIVACY_PULSE_SCALE = 1.1
const PRIVACY_PULSE_MS = 3600
// Concentric fade is ~0..1; start rain partway through so it overlaps the tail
const PRIVACY_RAIN_START_FADE_FRACTION = 0.58
/** Pause after a cluster fully fades before the next one (same for every cycle). */
const PRIVACY_RAIN_CYCLE_GAP_MS = 600
const PRIVACY_RAIN_SLOT_STAGGER_MS = 1880
const PRIVACY_RAIN_X_MARGIN = 0.1
const PRIVACY_RAIN_Y_MIN = 0.16
/** Max center Y as fraction of height — keep rain in upper 70% (avoid title / body copy). */
const PRIVACY_RAIN_Y_MAX = 0.7

// Privacy concentric rings (radius as fraction of screen width)
const RING_DEFS = [
  { opacity: 0.6, radiusFraction: 0.06 },
  { opacity: 0.42, radiusFraction: 0.15 },
  { opacity: 0.27, radiusFraction: 0.25 },
  { opacity: 0.16, radiusFraction: 0.36 },
  { opacity: 0.09, radiusFraction: 0.48 }
] as const

const PRIVACY_RING_ALPHA_EPS = 0.012

function privacySmooth(t: number) {
  'worklet'
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function privacyRingPaint(
  breathe: number,
  index: number,
  phase: number,
  ringCount: number,
  ringOpacity: number
) {
  'worklet'
  const revealEnd = ringCount
  const revealRaw = Math.min(
    1,
    Math.max(0, Math.min(phase, revealEnd) - index)
  )
  const revealProgress = privacySmooth(revealRaw)
  const fadeRaw = Math.min(1, Math.max(0, phase - revealEnd - index))
  const fadeProgress = privacySmooth(fadeRaw)
  const afterReveal = Math.pow(1 - fadeProgress, PRIVACY_FADE_OUT_OPACITY_EXP)
  let alpha = ringOpacity * revealProgress * afterReveal
  if (phase + 1e-4 >= 2 * revealEnd) {
    alpha = 0
  }
  if (alpha < PRIVACY_RING_ALPHA_EPS) {
    alpha = 0
  }
  const scale = (0.6 + revealProgress * 0.4) * breathe
  return {
    borderWidth: alpha === 0 ? 0 : 1,
    opacity: alpha,
    transform: [{ scale }]
  }
}

type RingItemProps = {
  centerX: number
  centerY: number
  index: number
  opacity: number
  radius: number
  ringPhase: SharedValue<number>
}

function RingItem({
  radius,
  centerX,
  centerY,
  opacity,
  index,
  ringPhase
}: RingItemProps) {
  const breathe = useSharedValue(1)
  const ringCount = RING_DEFS.length

  const animStyle = useAnimatedStyle(() => {
    return privacyRingPaint(
      breathe.value,
      index,
      ringPhase.value,
      ringCount,
      opacity
    )
  })

  useEffect(() => {
    const phaseDelay = index * 340
    breathe.set(
      withDelay(
        phaseDelay,
        withRepeat(
          withTiming(PRIVACY_PULSE_SCALE, {
            duration: PRIVACY_PULSE_MS,
            easing: Easing.inOut(Easing.sin)
          }),
          -1,
          true
        )
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        styles.ring,
        animStyle,
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

type ClusterRingItemProps = {
  centerX: SharedValue<number>
  centerY: SharedValue<number>
  index: number
  opacity: number
  radius: number
  ringPhase: SharedValue<number>
}

function ClusterRingItem({
  centerX,
  centerY,
  index,
  opacity,
  radius,
  ringPhase
}: ClusterRingItemProps) {
  const breathe = useSharedValue(1)
  const ringCount = RING_DEFS.length

  const animStyle = useAnimatedStyle(() => {
    const paint = privacyRingPaint(
      breathe.value,
      index,
      ringPhase.value,
      ringCount,
      opacity
    )
    return {
      ...paint,
      borderRadius: radius,
      height: radius * 2,
      left: centerX.value - radius,
      top: centerY.value - radius,
      width: radius * 2
    }
  })

  useEffect(() => {
    const phaseDelay = index * 340
    breathe.set(
      withDelay(
        phaseDelay,
        withRepeat(
          withTiming(PRIVACY_PULSE_SCALE, {
            duration: PRIVACY_PULSE_MS,
            easing: Easing.inOut(Easing.sin)
          }),
          -1,
          true
        )
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.ring, animStyle]} pointerEvents="none" />
  )
}

type PrivacyRainClusterSlotProps = {
  fadeDuration: number
  revealDuration: number
  screenHeight: number
  screenWidth: number
  startAfterMs: number
}

function PrivacyRainClusterSlot({
  fadeDuration,
  revealDuration,
  screenHeight,
  screenWidth,
  startAfterMs
}: PrivacyRainClusterSlotProps) {
  const clusterPhase = useSharedValue(0)
  const centerX = useSharedValue(screenWidth * 0.5)
  const centerY = useSharedValue(screenHeight * 0.42)

  const unmountedRef = useRef(false)
  const firstKickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const gapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    unmountedRef.current = false

    function scheduleAfterGap() {
      if (unmountedRef.current) {
        return
      }
      if (gapTimeoutRef.current !== null) {
        clearTimeout(gapTimeoutRef.current)
      }
      gapTimeoutRef.current = setTimeout(() => {
        gapTimeoutRef.current = null
        kick()
      }, PRIVACY_RAIN_CYCLE_GAP_MS)
    }

    function kick() {
      if (unmountedRef.current) {
        return
      }
      const xFrac =
        PRIVACY_RAIN_X_MARGIN + Math.random() * (1 - 2 * PRIVACY_RAIN_X_MARGIN)
      const yFrac =
        PRIVACY_RAIN_Y_MIN +
        Math.random() * (PRIVACY_RAIN_Y_MAX - PRIVACY_RAIN_Y_MIN)
      centerX.value = screenWidth * xFrac
      centerY.value = screenHeight * yFrac
      cancelAnimation(clusterPhase)
      clusterPhase.value = 0
      clusterPhase.value = withSequence(
        withTiming(RING_DEFS.length, {
          duration: revealDuration,
          easing: Easing.out(Easing.cubic)
        }),
        withTiming(
          RING_DEFS.length * 2,
          {
            duration: fadeDuration,
            easing: Easing.inOut(Easing.poly(5))
          },
          (finished) => {
            if (finished) {
              runOnJS(scheduleAfterGap)()
            }
          }
        )
      )
    }

    firstKickTimeoutRef.current = setTimeout(() => {
      firstKickTimeoutRef.current = null
      kick()
    }, startAfterMs)

    return () => {
      unmountedRef.current = true
      if (firstKickTimeoutRef.current !== null) {
        clearTimeout(firstKickTimeoutRef.current)
      }
      if (gapTimeoutRef.current !== null) {
        clearTimeout(gapTimeoutRef.current)
      }
      cancelAnimation(clusterPhase)
    }
  }, [
    clusterPhase,
    centerX,
    centerY,
    fadeDuration,
    revealDuration,
    screenHeight,
    screenWidth,
    startAfterMs
  ])

  return (
    <View style={styles.privacyRainCluster} pointerEvents="none">
      {RING_DEFS.map((ring, i) => {
        const radius = ring.radiusFraction * screenWidth
        return (
          <ClusterRingItem
            key={ring.radiusFraction}
            centerX={centerX}
            centerY={centerY}
            index={i}
            opacity={ring.opacity}
            radius={radius}
            ringPhase={clusterPhase}
          />
        )
      })}
    </View>
  )
}

type SSIntroAnimationPrivacyStepProps = {
  screenHeight: number
  screenWidth: number
}

function SSIntroAnimationPrivacyStep({
  screenWidth,
  screenHeight
}: SSIntroAnimationPrivacyStepProps) {
  const ringPhase = useSharedValue(0)

  const revealDuration =
    RING_DEFS.length * PRIVACY_STAGGER_MS + PRIVACY_REVEAL_MS
  const fadeDuration =
    RING_DEFS.length * PRIVACY_FADE_STAGGER_MS + PRIVACY_FADE_MS
  const rainStartMs =
    revealDuration + fadeDuration * PRIVACY_RAIN_START_FADE_FRACTION

  useEffect(() => {
    ringPhase.set(
      withSequence(
        withTiming(RING_DEFS.length, {
          duration: revealDuration,
          easing: Easing.out(Easing.cubic)
        }),
        withTiming(RING_DEFS.length * 2, {
          duration: fadeDuration,
          easing: Easing.inOut(Easing.poly(5))
        })
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const centerX = screenWidth / 2
  const centerY = screenHeight * PRIVACY_CENTER_Y_FRACTION

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {RING_DEFS.map((ring, i) => {
        const radius = ring.radiusFraction * screenWidth
        return (
          <RingItem
            key={ring.radiusFraction}
            radius={radius}
            centerX={centerX}
            centerY={centerY}
            opacity={ring.opacity}
            index={i}
            ringPhase={ringPhase}
          />
        )
      })}
      <PrivacyRainClusterSlot
        fadeDuration={fadeDuration}
        revealDuration={revealDuration}
        screenHeight={screenHeight}
        screenWidth={screenWidth}
        startAfterMs={rainStartMs}
      />
      <PrivacyRainClusterSlot
        fadeDuration={fadeDuration}
        revealDuration={revealDuration}
        screenHeight={screenHeight}
        screenWidth={screenWidth}
        startAfterMs={rainStartMs + PRIVACY_RAIN_SLOT_STAGGER_MS}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject
  },
  privacyRainCluster: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible'
  },
  ring: {
    borderColor: Colors.white,
    borderWidth: 1,
    position: 'absolute'
  }
})

export default SSIntroAnimationPrivacyStep
