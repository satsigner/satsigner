import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { Colors } from '@/styles'

// Coordination network graph — index 0 is the central descriptor node; all
// devices connect to it
const COORDINATION_NODES = [
  { cx: 0.5, cy: 0.38, opacity: 0.85, size: 52 }, // descriptor (center)
  { cx: 0.26, cy: 0.22, opacity: 0.64, size: 28 }, // co-signer 1
  { cx: 0.58, cy: 0.16, opacity: 0.6, size: 24 }, // co-signer 2
  { cx: 0.74, cy: 0.28, opacity: 0.58, size: 26 }, // co-signer 3
  { cx: 0.76, cy: 0.48, opacity: 0.52, size: 22 }, // relay
  { cx: 0.6, cy: 0.56, opacity: 0.5, size: 20 }, // local agent
  { cx: 0.34, cy: 0.54, opacity: 0.46, size: 18 }, // co-signer 4
  { cx: 0.22, cy: 0.42, opacity: 0.42, size: 16 } // relay
] as const

// All device nodes connect to the descriptor (index 0)
const COORDINATION_EDGES = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [0, 7]
] as const

const COORDINATION_NODE_REVEAL_MS = 350
const COORDINATION_NODE_STAGGER_MS = 120
const COORDINATION_EDGE_FADE_MS = 600
const COORDINATION_PULSE_MS = 3400
const COORDINATION_PULSE_MIN = 0.78

type CoordinationNodeProps = {
  cx: number
  cy: number
  index: number
  opacity: number
  revealProgress: SharedValue<number>
  screenHeight: number
  screenWidth: number
  size: number
}

function CoordinationNode({
  cx,
  cy,
  size,
  opacity,
  index,
  revealProgress,
  screenWidth,
  screenHeight
}: CoordinationNodeProps) {
  const breathe = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, revealProgress.value - index))
    const smooth = raw * raw * (3 - 2 * raw)
    return {
      opacity: opacity * smooth,
      transform: [{ scale: 0.2 + smooth * 0.8 }, { scale: breathe.value }]
    }
  })

  useEffect(() => {
    breathe.set(
      withDelay(
        index * 420,
        withRepeat(
          withTiming(1.06, {
            duration: 2800 + index * 90,
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
        styles.coordinationNode,
        animStyle,
        {
          borderRadius: size / 2,
          height: size,
          left: cx * screenWidth - size / 2,
          top: cy * screenHeight - size / 2,
          width: size
        }
      ]}
    />
  )
}

type SSIntroAnimationCoordinationStepProps = {
  screenHeight: number
  screenWidth: number
}

function SSIntroAnimationCoordinationStep({
  screenWidth,
  screenHeight
}: SSIntroAnimationCoordinationStepProps) {
  const revealProgress = useSharedValue(0)
  const edgeOpacity = useSharedValue(0)
  const pulseOpacity = useSharedValue(1)

  const edgeStyle = useAnimatedStyle(() => ({ opacity: edgeOpacity.value }))
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }))

  useEffect(() => {
    revealProgress.set(
      withTiming(
        COORDINATION_NODES.length,
        {
          duration:
            COORDINATION_NODES.length * COORDINATION_NODE_STAGGER_MS +
            COORDINATION_NODE_REVEAL_MS,
          easing: Easing.out(Easing.cubic)
        },
        () => {
          edgeOpacity.set(
            withTiming(1, { duration: COORDINATION_EDGE_FADE_MS })
          )
          pulseOpacity.set(
            withRepeat(
              withTiming(COORDINATION_PULSE_MIN, {
                duration: COORDINATION_PULSE_MS,
                easing: Easing.inOut(Easing.sin)
              }),
              -1,
              true
            )
          )
        }
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.fullScreen, pulseStyle]} pointerEvents="none">
      <Animated.View
        style={[styles.fullScreen, edgeStyle]}
        pointerEvents="none"
      >
        <Svg width={screenWidth} height={screenHeight}>
          {COORDINATION_EDGES.map(([from, to], i) => {
            const a = COORDINATION_NODES[from]
            const b = COORDINATION_NODES[to]
            return (
              <Path
                key={i}
                d={`M ${a.cx * screenWidth} ${a.cy * screenHeight} L ${
                  b.cx * screenWidth
                } ${b.cy * screenHeight}`}
                stroke="rgba(255,255,255,0.30)"
                strokeWidth={1}
              />
            )
          })}
        </Svg>
      </Animated.View>
      {COORDINATION_NODES.map((node, i) => (
        <CoordinationNode
          key={i}
          index={i}
          cx={node.cx}
          cy={node.cy}
          size={node.size}
          opacity={node.opacity}
          revealProgress={revealProgress}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  coordinationNode: {
    backgroundColor: Colors.white,
    position: 'absolute'
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject
  }
})

export default SSIntroAnimationCoordinationStep
