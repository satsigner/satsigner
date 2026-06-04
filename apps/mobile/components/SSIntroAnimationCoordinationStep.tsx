import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming
} from 'react-native-reanimated'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

import { Colors } from '@/styles'

const COORDINATION_INITIAL_DELAY_MS = 400
const COORDINATION_NODE_REVEAL_MS = 600
const COORDINATION_NODE_STAGGER_MS = 55
const COORDINATION_EDGE_REVEAL_MS = 280
const COORDINATION_EDGE_STAGGER_MS = 90

const SIGNING_CYCLE_MS = 10000
const SIGNING_INITIAL_PAUSE_MS = 3000
const SIGNING_FLASH_MS = 300
const SIGNING_PULSE_TRAVEL_MS = 700
const SIGNING_PHASE_GAP_MS = 150
const SIGNING_DESCRIPTOR_GAP_MS = 200
const SIGNING_DESCRIPTOR_POP_MS = 350

// One full signing exchange = inbound pulse (phone → center) + response
// pulses (center → other phones). We wait for the full exchange to resolve
// before the next phone signs.
const SIGNING_EXCHANGE_MS = SIGNING_PULSE_TRAVEL_MS * 2

const SIGNING_ALICE_START_MS = SIGNING_INITIAL_PAUSE_MS
const SIGNING_ALICE_EXCHANGE_END_MS =
  SIGNING_ALICE_START_MS + SIGNING_EXCHANGE_MS
const SIGNING_BOB_START_MS =
  SIGNING_ALICE_EXCHANGE_END_MS + SIGNING_PHASE_GAP_MS
const SIGNING_BOB_EXCHANGE_END_MS =
  SIGNING_BOB_START_MS + SIGNING_EXCHANGE_MS
const SIGNING_CAROL_START_MS =
  SIGNING_BOB_EXCHANGE_END_MS + SIGNING_PHASE_GAP_MS
const SIGNING_CAROL_EXCHANGE_END_MS =
  SIGNING_CAROL_START_MS + SIGNING_EXCHANGE_MS
const SIGNING_DESCRIPTOR_POP_START_MS =
  SIGNING_CAROL_EXCHANGE_END_MS + SIGNING_DESCRIPTOR_GAP_MS

const SIGNING_INDICATOR_FADE_MS = 200
const SIGNING_INDICATOR_ARRIVAL_MS = [
  SIGNING_ALICE_START_MS + SIGNING_PULSE_TRAVEL_MS,
  SIGNING_BOB_START_MS + SIGNING_PULSE_TRAVEL_MS,
  SIGNING_CAROL_START_MS + SIGNING_PULSE_TRAVEL_MS
] as const

// After Carol's pulse arrival completes (last indicator lit), the three
// indicators dissolve and a check mark scales in inside the descriptor.
const SIGNING_CHECK_REVEAL_START_MS =
  SIGNING_INDICATOR_ARRIVAL_MS[2] + SIGNING_INDICATOR_FADE_MS
const SIGNING_CHECK_REVEAL_MS = 280

// Coordination network graph — index 0 is the central descriptor node; all
// devices (rendered as phones) connect to it. Labels are device aliases
// followed by a trimmed sample npub. `signEventStartMs` is the cycleScript
// timestamp (ms) at which this node "signs" (phones) or "pops" (descriptor).
const COORDINATION_NODES = [
  {
    cx: 0.5,
    cy: 0.38,
    label: 'wsh(multi)',
    npub: 'npub1qhx5…vp9c',
    opacity: 1,
    shape: 'circle',
    signEventStartMs: SIGNING_DESCRIPTOR_POP_START_MS,
    size: 62
  },
  {
    cx: 0.5,
    cy: 0.21,
    label: 'Alice',
    npub: 'npub17u4j…8q3p',
    opacity: 1,
    shape: 'phone',
    signEventStartMs: SIGNING_ALICE_START_MS,
    size: 44
  },
  {
    cx: 0.82,
    cy: 0.33,
    label: 'Bob',
    npub: 'npub1k2n9…wm5x',
    opacity: 1,
    shape: 'phone',
    signEventStartMs: SIGNING_BOB_START_MS,
    size: 38
  },
  {
    cx: 0.7,
    cy: 0.52,
    label: 'Carol',
    npub: 'npub1p8h3…j7vy',
    opacity: 1,
    shape: 'phone',
    signEventStartMs: SIGNING_CAROL_START_MS,
    size: 40
  },
  {
    cx: 0.3,
    cy: 0.52,
    label: 'Dave',
    npub: 'npub1ze4t…fr6k',
    opacity: 1,
    shape: 'phone',
    signEventStartMs: null,
    size: 36
  },
  {
    cx: 0.18,
    cy: 0.33,
    label: 'Eve',
    npub: 'npub1v9c2…n5dx',
    opacity: 1,
    shape: 'phone',
    signEventStartMs: null,
    size: 34
  }
] as const

const COORDINATION_EDGES = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5]
] as const

type CoordinationNodeShape = 'circle' | 'phone'

type CoordinationNodeProps = {
  cx: number
  cy: number
  cycleScript: SharedValue<number>
  index: number
  label: string | null
  npub: string | null
  opacity: number
  revealProgress: SharedValue<number>
  screenHeight: number
  screenWidth: number
  shape: CoordinationNodeShape
  signEventStartMs: number | null
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

type CoordinationEdgeProps = {
  d: string
  edgeProgress: SharedValue<number>
  gradientId: string
  index: number
}

function CoordinationEdge({
  d,
  edgeProgress,
  gradientId,
  index
}: CoordinationEdgeProps) {
  const animatedProps = useAnimatedProps(() => {
    const raw = Math.min(1, Math.max(0, edgeProgress.value - index))
    const smooth = raw * raw * (3 - 2 * raw)
    return { opacity: smooth }
  })

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      d={d}
      stroke={`url(#${gradientId})`}
      strokeWidth={1}
    />
  )
}

type CoordinationPulseProps = {
  cycleScript: SharedValue<number>
  eventStartMs: number
  x1: number
  x2: number
  y1: number
  y2: number
}

function CoordinationPulse({
  cycleScript,
  eventStartMs,
  x1,
  x2,
  y1,
  y2
}: CoordinationPulseProps) {
  const animatedProps = useAnimatedProps(() => {
    const t = (cycleScript.value - eventStartMs) / SIGNING_PULSE_TRAVEL_MS
    const inRange = t >= 0 && t <= 1
    return {
      cx: inRange ? x1 + (x2 - x1) * t : x1,
      cy: inRange ? y1 + (y2 - y1) * t : y1,
      opacity: inRange ? Math.sin(Math.PI * t) : 0
    }
  })

  return (
    <AnimatedCircle animatedProps={animatedProps} r={3} fill={Colors.white} />
  )
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
  cycleScript,
  signEventStartMs,
  screenWidth,
  screenHeight
}: CoordinationNodeProps) {
  const breathe = useSharedValue(1)
  const eventDuration =
    shape === 'circle' ? SIGNING_DESCRIPTOR_POP_MS : SIGNING_FLASH_MS
  const eventScalePeak = shape === 'circle' ? 0.2 : 0.15

  const animStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, revealProgress.value - index))
    const smooth = raw * raw * (3 - 2 * raw)

    let eventScaleBoost = 0
    if (signEventStartMs !== null) {
      const t = (cycleScript.value - signEventStartMs) / eventDuration
      if (t >= 0 && t <= 1) {
        eventScaleBoost = eventScalePeak * Math.sin(Math.PI * t)
      }
    }

    return {
      opacity: opacity * smooth,
      transform: [
        { scale: 0.2 + smooth * 0.8 },
        { scale: breathe.value },
        { scale: 1 + eventScaleBoost }
      ]
    }
  })

  const borderStyle = useAnimatedStyle(() => {
    if (signEventStartMs === null || shape !== 'phone') {
      return { borderColor: Colors.gray[700] }
    }
    const t = (cycleScript.value - signEventStartMs) / SIGNING_FLASH_MS
    const signProgress = t >= 0 && t <= 1 ? Math.sin(Math.PI * t) : 0
    return {
      borderColor: interpolateColor(
        signProgress,
        [0, 1],
        [Colors.gray[700], Colors.white]
      )
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

  const indicator0Style = useAnimatedStyle(() => {
    const t =
      (cycleScript.value - SIGNING_INDICATOR_ARRIVAL_MS[0]) /
      SIGNING_INDICATOR_FADE_MS
    const progress = t <= 0 ? 0 : t >= 1 ? 1 : t
    const checkT =
      (cycleScript.value - SIGNING_CHECK_REVEAL_START_MS) /
      SIGNING_CHECK_REVEAL_MS
    const checkProgress = checkT <= 0 ? 0 : checkT >= 1 ? 1 : checkT
    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 1],
        [Colors.white, Colors.black]
      ),
      borderColor: interpolateColor(
        progress,
        [0, 1],
        [Colors.gray[75], Colors.black]
      ),
      opacity: 1 - checkProgress
    }
  })

  const indicator1Style = useAnimatedStyle(() => {
    const t =
      (cycleScript.value - SIGNING_INDICATOR_ARRIVAL_MS[1]) /
      SIGNING_INDICATOR_FADE_MS
    const progress = t <= 0 ? 0 : t >= 1 ? 1 : t
    const checkT =
      (cycleScript.value - SIGNING_CHECK_REVEAL_START_MS) /
      SIGNING_CHECK_REVEAL_MS
    const checkProgress = checkT <= 0 ? 0 : checkT >= 1 ? 1 : checkT
    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 1],
        [Colors.white, Colors.black]
      ),
      borderColor: interpolateColor(
        progress,
        [0, 1],
        [Colors.gray[75], Colors.black]
      ),
      opacity: 1 - checkProgress
    }
  })

  const indicator2Style = useAnimatedStyle(() => {
    const t =
      (cycleScript.value - SIGNING_INDICATOR_ARRIVAL_MS[2]) /
      SIGNING_INDICATOR_FADE_MS
    const progress = t <= 0 ? 0 : t >= 1 ? 1 : t
    const checkT =
      (cycleScript.value - SIGNING_CHECK_REVEAL_START_MS) /
      SIGNING_CHECK_REVEAL_MS
    const checkProgress = checkT <= 0 ? 0 : checkT >= 1 ? 1 : checkT
    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 1],
        [Colors.white, Colors.black]
      ),
      borderColor: interpolateColor(
        progress,
        [0, 1],
        [Colors.gray[75], Colors.black]
      ),
      opacity: 1 - checkProgress
    }
  })

  const checkStyle = useAnimatedStyle(() => {
    const t =
      (cycleScript.value - SIGNING_CHECK_REVEAL_START_MS) /
      SIGNING_CHECK_REVEAL_MS
    const progress = t <= 0 ? 0 : t >= 1 ? 1 : t
    const smooth = progress * progress * (3 - 2 * progress)
    return {
      opacity: smooth,
      transform: [{ scale: 0.4 + smooth * 0.6 }]
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
            borderStyle,
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

  const circleLabelTop = cy * screenHeight + size / 2 + PHONE_LABEL_GAP
  const circleNpubTop =
    circleLabelTop + PHONE_LABEL_LINE_HEIGHT + PHONE_NPUB_GAP

  return (
    <>
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
      >
        <Animated.View
          style={[styles.coordinationDescriptorIndicator, indicator0Style]}
        />
        <Animated.View
          style={[styles.coordinationDescriptorIndicator, indicator1Style]}
        />
        <Animated.View
          style={[styles.coordinationDescriptorIndicator, indicator2Style]}
        />
        <Animated.View
          style={[styles.coordinationDescriptorCheckWrapper, checkStyle]}
        >
          <Svg width={36} height={36} viewBox="0 0 32 32">
            <Circle
              cx={16}
              cy={16}
              r={13}
              fill="none"
              stroke={Colors.black}
              strokeWidth={0.6}
            />
            <Path
              d="M 10 16.5 L 14.5 21 L 22.5 12"
              fill="none"
              stroke={Colors.black}
              strokeWidth={0.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      </Animated.View>
      {label !== null && (
        <Animated.Text
          style={[
            styles.coordinationDescriptorLabel,
            labelStyle,
            {
              left: cx * screenWidth - PHONE_LABEL_WIDTH / 2,
              top: circleLabelTop,
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
              top: circleNpubTop,
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

type SSIntroAnimationCoordinationStepProps = {
  screenHeight: number
  screenWidth: number
}

function SSIntroAnimationCoordinationStep({
  screenWidth,
  screenHeight
}: SSIntroAnimationCoordinationStepProps) {
  const revealProgress = useSharedValue(0)
  const edgeProgress = useSharedValue(0)
  const cycleScript = useSharedValue(0)

  useEffect(() => {
    revealProgress.set(
      withDelay(
        COORDINATION_INITIAL_DELAY_MS,
        withTiming(
          COORDINATION_NODES.length,
          {
            duration:
              COORDINATION_NODES.length * COORDINATION_NODE_STAGGER_MS +
              COORDINATION_NODE_REVEAL_MS,
            easing: Easing.out(Easing.cubic)
          },
          () => {
            edgeProgress.set(
              withTiming(
                COORDINATION_EDGES.length,
                {
                  duration:
                    COORDINATION_EDGES.length * COORDINATION_EDGE_STAGGER_MS +
                    COORDINATION_EDGE_REVEAL_MS,
                  easing: Easing.out(Easing.cubic)
                },
                () => {
                  cycleScript.set(
                    withRepeat(
                      withTiming(SIGNING_CYCLE_MS, {
                        duration: SIGNING_CYCLE_MS,
                        easing: Easing.linear
                      }),
                      -1,
                      false
                    )
                  )
                }
              )
            )
          }
        )
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      <View style={[styles.fullScreen, styles.edgeLayer]} pointerEvents="none">
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
              <CoordinationEdge
                key={i}
                index={i}
                d={`M ${x1} ${y1} L ${x2} ${y2}`}
                gradientId={`coordinationEdge${i}`}
                edgeProgress={edgeProgress}
              />
            )
          })}
          {COORDINATION_EDGES.map(([from, to], i) => {
            const phoneNode = COORDINATION_NODES[to]
            if (phoneNode.signEventStartMs === null) return null
            const { x1, y1, x2, y2 } = getEdgeEndpoints(
              phoneNode,
              COORDINATION_NODES[from],
              screenWidth,
              screenHeight
            )
            return (
              <CoordinationPulse
                key={`pulse-${i}`}
                cycleScript={cycleScript}
                eventStartMs={phoneNode.signEventStartMs}
                x1={x1}
                x2={x2}
                y1={y1}
                y2={y2}
              />
            )
          })}
          {COORDINATION_EDGES.flatMap(([from, senderIdx], senderEdgeIdx) => {
            const senderNode = COORDINATION_NODES[senderIdx]
            if (senderNode.signEventStartMs === null) return []
            const responseStartMs =
              senderNode.signEventStartMs + SIGNING_PULSE_TRAVEL_MS
            return COORDINATION_EDGES.map(
              ([_, targetIdx], targetEdgeIdx) => {
                if (targetIdx === senderIdx) return null
                const { x1, y1, x2, y2 } = getEdgeEndpoints(
                  COORDINATION_NODES[from],
                  COORDINATION_NODES[targetIdx],
                  screenWidth,
                  screenHeight
                )
                return (
                  <CoordinationPulse
                    key={`response-${senderEdgeIdx}-${targetEdgeIdx}`}
                    cycleScript={cycleScript}
                    eventStartMs={responseStartMs}
                    x1={x1}
                    x2={x2}
                    y1={y1}
                    y2={y2}
                  />
                )
              }
            )
          })}
        </Svg>
      </View>
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
          cycleScript={cycleScript}
          signEventStartMs={node.signEventStartMs}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  coordinationNode: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 2
  },
  coordinationDescriptorIndicator: {
    borderRadius: 4,
    borderWidth: 1,
    height: 8,
    marginHorizontal: 2,
    width: 8
  },
  coordinationDescriptorCheckWrapper: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  coordinationPhone: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[700],
    borderWidth: 1,
    elevation: 2,
    position: 'absolute',
    zIndex: 2
  },
  coordinationDescriptorLabel: {
    color: Colors.gray[400],
    elevation: 2,
    fontSize: 9,
    letterSpacing: 0.3,
    lineHeight: PHONE_LABEL_LINE_HEIGHT,
    position: 'absolute',
    textAlign: 'center',
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
