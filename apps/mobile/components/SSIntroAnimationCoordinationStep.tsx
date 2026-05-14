import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import { Colors } from '@/styles'

// Coordination network graph — index 0 is the central descriptor node; all
// devices (rendered as phones) connect to it. Labels are device aliases
// followed by a trimmed sample npub.
const COORDINATION_NODES = [
  {
    cx: 0.5,
    cy: 0.38,
    label: null,
    npub: null,
    opacity: 1,
    shape: 'circle',
    size: 52
  },
  {
    cx: 0.26,
    cy: 0.22,
    label: 'Alice',
    npub: 'npub17u4j…8q3p',
    opacity: 1,
    shape: 'phone',
    size: 36
  },
  {
    cx: 0.58,
    cy: 0.16,
    label: 'Bob',
    npub: 'npub1k2n9…wm5x',
    opacity: 1,
    shape: 'phone',
    size: 32
  },
  {
    cx: 0.74,
    cy: 0.28,
    label: 'Carol',
    npub: 'npub1p8h3…j7vy',
    opacity: 1,
    shape: 'phone',
    size: 34
  },
  {
    cx: 0.76,
    cy: 0.48,
    label: 'Dave',
    npub: 'npub1ze4t…fr6k',
    opacity: 1,
    shape: 'phone',
    size: 30
  },
  {
    cx: 0.6,
    cy: 0.56,
    label: 'Eve',
    npub: 'npub1v9c2…n5dx',
    opacity: 1,
    shape: 'phone',
    size: 28
  },
  {
    cx: 0.34,
    cy: 0.54,
    label: 'Frank',
    npub: 'npub1q7g0…l4bp',
    opacity: 1,
    shape: 'phone',
    size: 26
  },
  {
    cx: 0.22,
    cy: 0.42,
    label: 'Grace',
    npub: 'npub1m3t8…uy2h',
    opacity: 1,
    shape: 'phone',
    size: 24
  }
] as const

const COORDINATION_EDGES = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [0, 7]
] as const

const COORDINATION_NODE_REVEAL_MS = 180
const COORDINATION_NODE_STAGGER_MS = 55
const COORDINATION_EDGE_FADE_MS = 300

type CoordinationNodeShape = 'circle' | 'phone'

type CoordinationNodeProps = {
  cx: number
  cy: number
  index: number
  label: string | null
  npub: string | null
  opacity: number
  revealProgress: SharedValue<number>
  screenHeight: number
  screenWidth: number
  shape: CoordinationNodeShape
  size: number
}

const PHONE_WIDTH_RATIO = 0.58
const PHONE_CORNER_RATIO = 0.09
const PHONE_LABEL_GAP = 4
const PHONE_LABEL_WIDTH = 90
const PHONE_LABEL_LINE_HEIGHT = 12
const PHONE_NPUB_LINE_HEIGHT = 10
const PHONE_NPUB_GAP = 1

type CoordinationNodeData = (typeof COORDINATION_NODES)[number]

function getNodeEdgeDistance(
  node: CoordinationNodeData,
  ux: number,
  uy: number
): number {
  if (node.shape === 'circle') {
    return node.size / 2
  }
  const halfWidth = Math.max(8, node.size * PHONE_WIDTH_RATIO) / 2
  const halfHeight = node.size / 2
  const tx = ux !== 0 ? halfWidth / Math.abs(ux) : Infinity
  const ty = uy !== 0 ? halfHeight / Math.abs(uy) : Infinity
  return Math.min(tx, ty)
}

function getEdgeEndpoints(
  a: CoordinationNodeData,
  b: CoordinationNodeData,
  screenWidth: number,
  screenHeight: number
) {
  const ax = a.cx * screenWidth
  const ay = a.cy * screenHeight
  const bx = b.cx * screenWidth
  const by = b.cy * screenHeight
  const dx = bx - ax
  const dy = by - ay
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return { x1: ax, x2: bx, y1: ay, y2: by }
  const ux = dx / dist
  const uy = dy / dist
  const startOffset = getNodeEdgeDistance(a, ux, uy)
  const endOffset = getNodeEdgeDistance(b, -ux, -uy)
  return {
    x1: ax + ux * startOffset,
    x2: bx - ux * endOffset,
    y1: ay + uy * startOffset,
    y2: by - uy * endOffset
  }
}

function CoordinationNode({
  cx,
  cy,
  size,
  shape,
  label,
  npub,
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

  const labelStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, revealProgress.value - index))
    const smooth = raw * raw * (3 - 2 * raw)
    return { opacity: 0.7 * smooth }
  })

  const npubStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, revealProgress.value - index))
    const smooth = raw * raw * (3 - 2 * raw)
    return { opacity: 0.4 * smooth }
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

  if (shape === 'phone') {
    const phoneHeight = size
    const phoneWidth = Math.max(8, size * PHONE_WIDTH_RATIO)
    const cornerRadius = Math.max(1, size * PHONE_CORNER_RATIO)
    const labelTop = cy * screenHeight + phoneHeight / 2 + PHONE_LABEL_GAP
    const npubTop = labelTop + PHONE_LABEL_LINE_HEIGHT + PHONE_NPUB_GAP

    return (
      <>
        <Animated.View
          style={[
            styles.coordinationPhone,
            animStyle,
            {
              borderRadius: cornerRadius,
              height: phoneHeight,
              left: cx * screenWidth - phoneWidth / 2,
              top: cy * screenHeight - phoneHeight / 2,
              width: phoneWidth
            }
          ]}
        />
        {label !== null && (
          <Animated.Text
            style={[
              styles.coordinationPhoneLabel,
              labelStyle,
              {
                left: cx * screenWidth - PHONE_LABEL_WIDTH / 2,
                top: labelTop,
                width: PHONE_LABEL_WIDTH
              }
            ]}
          >
            {label}
          </Animated.Text>
        )}
        {npub !== null && (
          <Animated.Text
            style={[
              styles.coordinationPhoneNpub,
              npubStyle,
              {
                left: cx * screenWidth - PHONE_LABEL_WIDTH / 2,
                top: npubTop,
                width: PHONE_LABEL_WIDTH
              }
            ]}
          >
            {npub}
          </Animated.Text>
        )}
      </>
    )
  }

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

  const edgeStyle = useAnimatedStyle(() => ({ opacity: edgeOpacity.value }))

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
        }
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      <Animated.View
        style={[styles.fullScreen, styles.edgeLayer, edgeStyle]}
        pointerEvents="none"
      >
        <Svg width={screenWidth} height={screenHeight}>
          <Defs>
            {COORDINATION_EDGES.map(([from, to], i) => {
              const { x1, y1, x2, y2 } = getEdgeEndpoints(
                COORDINATION_NODES[from],
                COORDINATION_NODES[to],
                screenWidth,
                screenHeight
              )
              return (
                <LinearGradient
                  key={i}
                  id={`coordinationEdge${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop
                    offset="0"
                    stopColor={Colors.gray[700]}
                    stopOpacity="0.85"
                  />
                  <Stop
                    offset="1"
                    stopColor={Colors.gray[850]}
                    stopOpacity="0.15"
                  />
                </LinearGradient>
              )
            })}
          </Defs>
          {COORDINATION_EDGES.map(([from, to], i) => {
            const { x1, y1, x2, y2 } = getEdgeEndpoints(
              COORDINATION_NODES[from],
              COORDINATION_NODES[to],
              screenWidth,
              screenHeight
            )
            return (
              <Path
                key={i}
                d={`M ${x1} ${y1} L ${x2} ${y2}`}
                stroke={`url(#coordinationEdge${i})`}
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
          shape={node.shape}
          label={node.label}
          npub={node.npub}
          opacity={node.opacity}
          revealProgress={revealProgress}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  coordinationNode: {
    backgroundColor: Colors.white,
    elevation: 2,
    position: 'absolute',
    zIndex: 2
  },
  coordinationPhone: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[600],
    borderWidth: 1,
    elevation: 2,
    position: 'absolute',
    zIndex: 2
  },
  coordinationPhoneLabel: {
    color: Colors.gray[400],
    elevation: 2,
    fontSize: 9,
    letterSpacing: 0.6,
    lineHeight: PHONE_LABEL_LINE_HEIGHT,
    position: 'absolute',
    textAlign: 'center',
    textTransform: 'uppercase',
    zIndex: 2
  },
  coordinationPhoneNpub: {
    color: Colors.gray[600],
    elevation: 2,
    fontSize: 7,
    letterSpacing: 0.3,
    lineHeight: PHONE_NPUB_LINE_HEIGHT,
    position: 'absolute',
    textAlign: 'center',
    zIndex: 2
  },
  edgeLayer: {
    elevation: 0,
    zIndex: 0
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject
  }
})

export default SSIntroAnimationCoordinationStep
