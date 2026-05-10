import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path } from 'react-native-svg'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated'
import { hierarchy, pack } from 'd3'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { t } from '@/locales'
import { Colors, Typography } from '@/styles'

// Visual constants
const LOGO_SIZE = 140
const LOGO_FONT_SIZE = 20
const LOGO_LETTER_SPACING = 4
const HEX_FONT_SIZE = 10
const HEX_LEFT_PADDING = 16
const FLOW_LINE_OPACITY = 0.25
const FLOW_LINE_HEIGHT = 1
const DOT_SIZE = 6
const DOT_GAP = 8
const STEP_COUNT = 9
const MIN_BOTTOM_PADDING = 24

// Step transition timing (ms / px)
const TRANSITION_MS = 320
const SLIDE_OUT_OFFSET = -24
const SLIDE_IN_OFFSET = 32
const TEXT_SLIDE_DELAY = 40
const DESC_SLIDE_DELAY = 90

// Hex step constants
const HEX_REVEAL_MS = 380
const HEX_LOOP_RANGE = 8
const HEX_LOOP_MS = 4000
const HEX_LOOP_Y_RANGE = 6
const HEX_LOOP_Y_MS = 5500

// Bubble step constants
const BUBBLE_BREATHE_MAX = 1.05
const BUBBLE_BREATHE_MS = 3000
const UTXO_ENTER_MS = 400
const UTXO_ENTER_STAGGER_MS = 90
const UTXO_EXIT_MS = 320
const UTXO_CYCLE_MS = 3000
const UTXO_REMOVE_MAX = 2
const UTXO_ADD_MAX = 2
const UTXO_MIN_COUNT = 5
const UTXO_MAX_COUNT = 12
const UTXO_PACK_PADDING = 6
const UTXO_SPRING_DAMPING = 16
const UTXO_SPRING_STIFFNESS = 110

// Sankey step constants
const SANKEY_PHASE_MS = 650
const SANKEY_PHASE_GAP_MS = 700
const SANKEY_PULSE_MIN = 0.82
const SANKEY_PULSE_MS = 3200

// Phone frame step constants
const PHONE_SCALE_TARGET = 0.68
const PHONE_SCALE_MS = 500
const PHONE_UI_COUNT = 5
const PHONE_STAGGER_MS = 90
const PHONE_FADE_MS = 280
const PHONE_SLIDE_Y = 16
const PHONE_FRAME_RADIUS = 32
const PHONE_HEADER_TOP = 80
const PHONE_HIGHLIGHT_SWEEP_MS = 500
const PHONE_HIGHLIGHT_PAUSE_MS = 4500

// Privacy step constants
const PRIVACY_CENTER_Y_FRACTION = 0.38
const PRIVACY_STAGGER_MS = 160
const PRIVACY_REVEAL_MS = 450
const PRIVACY_PULSE_SCALE = 1.10
const PRIVACY_PULSE_MS = 3600

// Explorer step constants
const EXPLORER_BLOCK_SIZE = 36
const EXPLORER_CONNECTOR_W = 16
const EXPLORER_BLOCK_COUNT = 9
const EXPLORER_CHAIN_WIDTH =
  EXPLORER_BLOCK_COUNT * EXPLORER_BLOCK_SIZE +
  (EXPLORER_BLOCK_COUNT - 1) * EXPLORER_CONNECTOR_W
const EXPLORER_TOP_FRACTION = 0.38
const EXPLORER_REVEAL_SCALE = 0.88
const EXPLORER_REVEAL_MS = 550
const EXPLORER_SCAN_MS = 2600
const EXPLORER_SCAN_FADE_IN_PX = 10
const EXPLORER_SCAN_FADE_OUT_PX = 72
const EXPLORER_SCAN_EDGE_FADE_PX = 32

// Roadmap step constants
const ROADMAP_ITEM_COUNT = 5
const ROADMAP_STAGGER_MS = 110
const ROADMAP_FADE_MS = 280
const ROADMAP_SLIDE_Y = 12
const ROADMAP_DOT_SIZE = 10
const ROADMAP_ROW_FRACTION = 0.1
const ROADMAP_TOP_FRACTION = 0.1
const ROADMAP_LEFT_FRACTION = 0.22

// Thanks step constants
const THANKS_REVEAL_MS = 600
const THANKS_BREATHE_MAX = 1.05
const THANKS_BREATHE_MS = 3200
const THANKS_REVEAL_SCALE = 0.6

// Logo finale timing (ms)
const CIRCLE_IN_MS = 500
const LOGO_IN_MS = 400
const LOGO_OVERLAP_MS = 200
const LOGO_HOLD_MS = 400
const FADE_OUT_MS = 400

// Returning user timing (ms)
const RETURNING_CIRCLE_IN = 400
const RETURNING_LOGO_IN = 400
const RETURNING_HOLD = 200
const RETURNING_FADE_OUT = 400
const RETURNING_LOGO_DELAY = RETURNING_CIRCLE_IN
const RETURNING_FADE_DELAY =
  RETURNING_CIRCLE_IN + RETURNING_LOGO_IN + RETURNING_HOLD

// Hex dump rows — Bitcoin transaction-like byte sequences
const HEX_ROWS = [
  {
    opacity: 0.4,
    text: '0000  01 00 00 00  01 f3 a9 b4  c2 e8 d7 f1  23 45 67 89',
    topFraction: 0.06
  },
  {
    opacity: 0.25,
    text: '0010  0a bc de f0  12 34 56 78  9a bc de f0  01 00 00 00',
    topFraction: 0.11
  },
  {
    opacity: 0.5,
    text: '0020  ff ff ff ff  00 00 00 00  01 40 42 0f  00 00 00 00',
    topFraction: 0.16
  },
  {
    opacity: 0.3,
    text: '0030  19 76 a9 14  89 ab cd ef  01 23 45 67  88 ac 00 00',
    topFraction: 0.21
  },
  {
    opacity: 0.45,
    text: '0040  02 00 00 00  00 01 01 a1  b2 c3 d4 e5  f6 78 90 ab',
    topFraction: 0.26
  },
  {
    opacity: 0.2,
    text: '0050  cd ef fe dc  ba 98 76 54  32 10 fd fe  ff 00 00 00',
    topFraction: 0.31
  },
  {
    opacity: 0.5,
    text: '0060  00 48 30 45  02 21 00 c4  d5 e6 f7 a8  b9 ca db ec',
    topFraction: 0.36
  },
  {
    opacity: 0.35,
    text: '0070  02 20 5d 4e  3f 2e 1d 0c  fb ea d9 c8  b7 a6 95 84',
    topFraction: 0.41
  },
  {
    opacity: 0.3,
    text: '0080  73 62 51 40  2f 1e 0d fc  00 01 21 02  31 41 51 61',
    topFraction: 0.46
  },
  {
    opacity: 0.4,
    text: '0090  71 81 91 a1  b1 c1 d1 e1  f1 02 03 04  05 06 07 08',
    topFraction: 0.51
  }
] as const

// Bubble chart — cx/cy = center fractions of screen; size in px; opacity drives visual weight
// Larger bubbles = larger UTXOs (dominant holdings), smaller = dust/change outputs
// UTXO value pool — used to randomly sample bubble sizes (proportional to sqrt of value)
const UTXO_VALUE_POOL = [900, 600, 450, 320, 250, 200, 160, 130, 100, 80, 60, 45, 35, 25, 18, 12, 8, 5] as const

let _utxoBubbleIdCounter = 0

// Sankey diagram bands: x1,t1,b1 = left x, top-y, bottom-y (fractions); x2,t2,b2 = right side; op = opacity
// Level 0 = outputs (rightmost, appears first); levels reveal left-ward each phase
type SankeyBand = { b1: number; b2: number; op: number; t1: number; t2: number; x1: number; x2: number }

// Bands are precisely aligned at junctions: Level2 right → Level1 left → Level0 left
// x1=0.28 and x2=0.54 are the junction columns; heights are kept thin (0.08–0.20)
const SANKEY_LEVEL_0: SankeyBand[] = [
  { x1: 0.54, t1: 0.30, b1: 0.48, x2: 0.98, t2: 0.18, b2: 0.44, op: 0.68 },
  { x1: 0.54, t1: 0.54, b1: 0.66, x2: 0.98, t2: 0.62, b2: 0.76, op: 0.44 }
]

const SANKEY_LEVEL_1: SankeyBand[] = [
  { x1: 0.28, t1: 0.14, b1: 0.34, x2: 0.54, t2: 0.30, b2: 0.44, op: 0.58 },
  { x1: 0.28, t1: 0.40, b1: 0.54, x2: 0.54, t2: 0.44, b2: 0.56, op: 0.50 },
  { x1: 0.28, t1: 0.60, b1: 0.74, x2: 0.54, t2: 0.56, b2: 0.66, op: 0.42 }
]

const SANKEY_LEVEL_2: SankeyBand[] = [
  { x1: 0.01, t1: 0.06, b1: 0.22, x2: 0.28, t2: 0.14, b2: 0.26, op: 0.40 },
  { x1: 0.01, t1: 0.28, b1: 0.38, x2: 0.28, t2: 0.26, b2: 0.34, op: 0.38 },
  { x1: 0.01, t1: 0.42, b1: 0.54, x2: 0.28, t2: 0.40, b2: 0.54, op: 0.40 },
  { x1: 0.01, t1: 0.62, b1: 0.76, x2: 0.28, t2: 0.60, b2: 0.74, op: 0.36 }
]

// Privacy concentric rings (radius as fraction of screen width)
const RING_DEFS = [
  { opacity: 0.6, radiusFraction: 0.06 },
  { opacity: 0.42, radiusFraction: 0.15 },
  { opacity: 0.27, radiusFraction: 0.25 },
  { opacity: 0.16, radiusFraction: 0.36 },
  { opacity: 0.09, radiusFraction: 0.48 }
] as const

// Nostr network graph — index 0 is the central descriptor node; all devices connect to it
const NOSTR_NODES = [
  { cx: 0.50, cy: 0.34, opacity: 0.85, size: 52 }, // descriptor (center)
  { cx: 0.19, cy: 0.19, opacity: 0.64, size: 28 }, // co-signer 1
  { cx: 0.50, cy: 0.10, opacity: 0.60, size: 24 }, // co-signer 2
  { cx: 0.81, cy: 0.19, opacity: 0.58, size: 26 }, // co-signer 3
  { cx: 0.88, cy: 0.44, opacity: 0.52, size: 22 }, // relay
  { cx: 0.72, cy: 0.56, opacity: 0.50, size: 20 }, // local agent
  { cx: 0.28, cy: 0.56, opacity: 0.46, size: 18 }, // co-signer 4
  { cx: 0.12, cy: 0.44, opacity: 0.42, size: 16 }  // relay
] as const

// All device nodes connect to the descriptor (index 0)
const NOSTR_EDGES = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7]
] as const

const NOSTR_NODE_REVEAL_MS = 350
const NOSTR_NODE_STAGGER_MS = 120
const NOSTR_EDGE_FADE_MS = 600
const NOSTR_PULSE_MS = 3400
const NOSTR_PULSE_MIN = 0.78

// Roadmap milestones — filled = shipped, outlined = upcoming
const ROADMAP_ITEMS = [
  { done: true },
  { done: true },
  { done: true },
  { done: false },
  { done: false }
] as const

// Explorer — pre-defined transaction bars per block [x, y, w, h]
const EXPLORER_TX_DEFS = [
  [{ h: 3, w: 20, x: 3, y: 4 }, { h: 3, w: 12, x: 3, y: 10 }, { h: 3, w: 18, x: 3, y: 16 }, { h: 3, w: 9, x: 3, y: 22 }],
  [{ h: 3, w: 15, x: 3, y: 4 }, { h: 3, w: 24, x: 3, y: 10 }, { h: 3, w: 11, x: 3, y: 16 }, { h: 3, w: 19, x: 3, y: 22 }, { h: 3, w: 13, x: 3, y: 28 }],
  [{ h: 3, w: 22, x: 3, y: 4 }, { h: 3, w: 14, x: 3, y: 10 }, { h: 3, w: 17, x: 3, y: 22 }],
  [{ h: 3, w: 11, x: 3, y: 4 }, { h: 3, w: 21, x: 3, y: 10 }, { h: 3, w: 16, x: 3, y: 16 }, { h: 3, w: 25, x: 3, y: 22 }, { h: 3, w: 8, x: 3, y: 28 }],
  [{ h: 3, w: 18, x: 3, y: 4 }, { h: 3, w: 10, x: 3, y: 10 }, { h: 3, w: 14, x: 3, y: 22 }, { h: 3, w: 23, x: 3, y: 28 }],
  [{ h: 3, w: 14, x: 3, y: 4 }, { h: 3, w: 8, x: 3, y: 10 }, { h: 3, w: 22, x: 3, y: 16 }, { h: 3, w: 13, x: 3, y: 22 }, { h: 3, w: 19, x: 3, y: 28 }],
  [{ h: 3, w: 17, x: 3, y: 4 }, { h: 3, w: 23, x: 3, y: 10 }, { h: 3, w: 10, x: 3, y: 16 }, { h: 3, w: 20, x: 3, y: 22 }],
  [{ h: 3, w: 25, x: 3, y: 4 }, { h: 3, w: 13, x: 3, y: 10 }, { h: 3, w: 15, x: 3, y: 22 }, { h: 3, w: 9, x: 3, y: 28 }, { h: 3, w: 18, x: 3, y: 16 }],
  [{ h: 3, w: 16, x: 3, y: 10 }, { h: 3, w: 21, x: 3, y: 16 }, { h: 3, w: 12, x: 3, y: 22 }],
  [{ h: 3, w: 9, x: 3, y: 4 }, { h: 3, w: 20, x: 3, y: 10 }, { h: 3, w: 15, x: 3, y: 16 }, { h: 3, w: 24, x: 3, y: 22 }, { h: 3, w: 11, x: 3, y: 28 }],
  [{ h: 3, w: 19, x: 3, y: 4 }, { h: 3, w: 11, x: 3, y: 10 }, { h: 3, w: 23, x: 3, y: 22 }, { h: 3, w: 14, x: 3, y: 28 }]
] as const

// Thanks — scattered circles representing contributors and orgs
const THANKS_CIRCLES = [
  { leftFraction: 0.14, opacity: 0.65, size: 52, topFraction: 0.1 },
  { leftFraction: 0.68, opacity: 0.5, size: 36, topFraction: 0.07 },
  { leftFraction: 0.44, opacity: 0.85, size: 70, topFraction: 0.26 },
  { leftFraction: 0.82, opacity: 0.42, size: 32, topFraction: 0.33 },
  { leftFraction: 0.06, opacity: 0.52, size: 44, topFraction: 0.42 },
  { leftFraction: 0.6, opacity: 0.62, size: 50, topFraction: 0.45 },
  { leftFraction: 0.28, opacity: 0.38, size: 28, topFraction: 0.58 },
  { leftFraction: 0.76, opacity: 0.55, size: 58, topFraction: 0.2 },
  { leftFraction: 0.35, opacity: 0.48, size: 42, topFraction: 0.14 },
  { leftFraction: 0.9, opacity: 0.35, size: 24, topFraction: 0.52 }
] as const

const STEP_CONFIGS = [
  {
    descriptionKey: 'intro.steps.transactions.description' as const,
    titleKey: 'intro.steps.transactions.title' as const
  },
  {
    descriptionKey: 'intro.steps.utxos.description' as const,
    titleKey: 'intro.steps.utxos.title' as const
  },
  {
    descriptionKey: 'intro.steps.sign.description' as const,
    titleKey: 'intro.steps.sign.title' as const
  },
  {
    descriptionKey: 'intro.steps.layers.description' as const,
    titleKey: 'intro.steps.layers.title' as const
  },
  {
    descriptionKey: 'intro.steps.privacy.description' as const,
    titleKey: 'intro.steps.privacy.title' as const
  },
  {
    descriptionKey: 'intro.steps.nostr.description' as const,
    titleKey: 'intro.steps.nostr.title' as const
  },
  {
    descriptionKey: 'intro.steps.explorer.description' as const,
    titleKey: 'intro.steps.explorer.title' as const
  },
  {
    descriptionKey: 'intro.steps.roadmap.description' as const,
    titleKey: 'intro.steps.roadmap.title' as const
  },
  {
    descriptionKey: 'intro.steps.thanks.description' as const,
    titleKey: 'intro.steps.thanks.title' as const
  }
]

type HexStreamStepProps = {
  screenHeight: number
  screenWidth: number
}

function HexStreamStep({ screenWidth, screenHeight }: HexStreamStepProps) {
  const clipWidth = useSharedValue(0)
  const driftX = useSharedValue(0)
  const driftY = useSharedValue(0)

  const clipStyle = useAnimatedStyle(() => ({
    width: clipWidth.value
  }))

  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: driftX.value }, { translateY: driftY.value }]
  }))

  useEffect(() => {
    clipWidth.set(
      withTiming(screenWidth, {
        duration: HEX_REVEAL_MS,
        easing: Easing.out(Easing.cubic)
      })
    )
    driftX.set(
      withDelay(
        HEX_REVEAL_MS,
        withRepeat(
          withTiming(HEX_LOOP_RANGE, {
            duration: HEX_LOOP_MS,
            easing: Easing.inOut(Easing.sin)
          }),
          -1,
          true
        )
      )
    )
    driftY.set(
      withRepeat(
        withTiming(HEX_LOOP_Y_RANGE, {
          duration: HEX_LOOP_Y_MS,
          easing: Easing.inOut(Easing.sin)
        }),
        -1,
        true
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.hexClip, clipStyle]} pointerEvents="none">
      <Animated.View style={[styles.fullScreen, driftStyle]}>
        {HEX_ROWS.map((row) => (
          <Text
            key={row.topFraction}
            style={[
              styles.hexText,
              {
                color: `rgba(255,255,255,${row.opacity})`,
                top: row.topFraction * screenHeight
              }
            ]}
          >
            {row.text}
          </Text>
        ))}
      </Animated.View>
    </Animated.View>
  )
}

type LiveUtxoBubble = {
  enterDelay: number
  exiting: boolean
  id: number
  value: number
}

type PackedUtxoBubble = {
  cx: number
  cy: number
  enterDelay: number
  exiting: boolean
  id: number
  opacity: number
  r: number
}

type BubblePackDatum = {
  children?: BubblePackDatum[]
  id: number
  value: number
}

function computePackedBubbles(
  bubbles: LiveUtxoBubble[],
  screenWidth: number,
  screenHeight: number
): PackedUtxoBubble[] {
  if (bubbles.length === 0) return []

  const packW = screenWidth * 0.90
  const packH = screenHeight * 0.48
  const offsetX = (screenWidth - packW) / 2
  const offsetY = screenHeight * 0.12

  const root = hierarchy<BubblePackDatum>({
    children: bubbles.map(b => ({ id: b.id, value: b.value })),
    id: -1,
    value: 0
  })
    .sum(d => d.value)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const packer = pack<BubblePackDatum>().size([packW, packH]).padding(UTXO_PACK_PADDING)
  const leaves = packer(root).leaves()
  const maxR = Math.max(...leaves.map(l => l.r), 1)

  return leaves.map(leaf => {
    const bubble = bubbles.find(b => b.id === leaf.data.id)!
    return {
      cx: leaf.x + offsetX,
      cy: leaf.y + offsetY,
      enterDelay: bubble.enterDelay,
      exiting: bubble.exiting,
      id: leaf.data.id,
      opacity: 0.14 + (leaf.r / maxR) * 0.54,
      r: leaf.r
    }
  })
}

type LiveBubbleItemProps = {
  cx: number
  cy: number
  enterDelay: number
  exiting: boolean
  id: number
  onExited: (id: number) => void
  opacity: number
  r: number
}

function LiveBubbleItem({ id, cx, cy, r, opacity, enterDelay, exiting, onExited }: LiveBubbleItemProps) {
  const scaleAnim = useSharedValue(0)
  const xAnim = useSharedValue(cx)
  const yAnim = useSharedValue(cy)
  const breathe = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    opacity,
    transform: [
      { translateX: xAnim.value - r },
      { translateY: yAnim.value - r },
      { scale: scaleAnim.value * breathe.value }
    ]
  }))

  useEffect(() => {
    scaleAnim.set(
      withDelay(
        enterDelay,
        withTiming(1, { duration: UTXO_ENTER_MS, easing: Easing.out(Easing.back(1.08)) }, () => {
          breathe.set(
            withDelay(
              (id % 12) * 370,
              withRepeat(
                withTiming(BUBBLE_BREATHE_MAX, {
                  duration: BUBBLE_BREATHE_MS + (id % 8) * 60,
                  easing: Easing.inOut(Easing.sin)
                }),
                -1,
                true
              )
            )
          )
        })
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (exiting) {
      breathe.set(withTiming(1, { duration: 80 }))
      scaleAnim.set(
        withTiming(0, { duration: UTXO_EXIT_MS, easing: Easing.in(Easing.cubic) }, () => {
          runOnJS(onExited)(id)
        })
      )
    }
  }, [exiting]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    xAnim.set(withSpring(cx, { damping: UTXO_SPRING_DAMPING, stiffness: UTXO_SPRING_STIFFNESS }))
    yAnim.set(withSpring(cy, { damping: UTXO_SPRING_DAMPING, stiffness: UTXO_SPRING_STIFFNESS }))
  }, [cx, cy]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        styles.bubble,
        animStyle,
        {
          borderRadius: r,
          height: r * 2,
          left: 0,
          top: 0,
          width: r * 2
        }
      ]}
    />
  )
}

type BubbleStepProps = {
  screenHeight: number
  screenWidth: number
}

function BubbleStep({ screenWidth, screenHeight }: BubbleStepProps) {
  const initialBubbles = useRef<LiveUtxoBubble[] | null>(null)
  if (!initialBubbles.current) {
    // Sort descending so largest bubble appears first, smaller ones follow
    const picked = [...UTXO_VALUE_POOL]
      .sort(() => Math.random() - 0.5)
      .slice(0, 9)
      .sort((a, b) => b - a)
    initialBubbles.current = picked.map((value, index) => ({
      enterDelay: index * UTXO_ENTER_STAGGER_MS,
      exiting: false,
      id: _utxoBubbleIdCounter++,
      value
    }))
  }

  const [bubbles, setBubbles] = useState<LiveUtxoBubble[]>(initialBubbles.current)
  const packed = computePackedBubbles(bubbles, screenWidth, screenHeight)

  function handleExited(id: number) {
    setBubbles(prev => prev.filter(b => b.id !== id))
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setBubbles(prev => {
        const active = prev.filter(b => !b.exiting)
        const removeCount = Math.min(
          Math.floor(Math.random() * UTXO_REMOVE_MAX) + 1,
          Math.max(0, active.length - UTXO_MIN_COUNT)
        )
        const addCount = Math.min(
          Math.floor(Math.random() * (UTXO_ADD_MAX + 1)),
          UTXO_MAX_COUNT - (active.length - removeCount)
        )

        const shuffled = [...active].sort(() => Math.random() - 0.5)
        const toRemoveIds = new Set(shuffled.slice(0, removeCount).map(b => b.id))
        const newBubbles: LiveUtxoBubble[] = Array.from({ length: addCount }, () => ({
          enterDelay: 0,
          exiting: false,
          id: _utxoBubbleIdCounter++,
          value: UTXO_VALUE_POOL[Math.floor(Math.random() * UTXO_VALUE_POOL.length)]
        }))

        return [
          ...prev.map(b => (toRemoveIds.has(b.id) ? { ...b, exiting: true } : b)),
          ...newBubbles
        ]
      })
    }, UTXO_CYCLE_MS)

    return () => clearInterval(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {packed.map(b => (
        <LiveBubbleItem
          key={b.id}
          id={b.id}
          cx={b.cx}
          cy={b.cy}
          r={b.r}
          opacity={b.opacity}
          enterDelay={b.enterDelay}
          exiting={b.exiting}
          onExited={handleExited}
        />
      ))}
    </View>
  )
}

type NostrNodeProps = {
  cx: number
  cy: number
  index: number
  opacity: number
  revealProgress: SharedValue<number>
  screenHeight: number
  screenWidth: number
  size: number
}

function NostrNode({ cx, cy, size, opacity, index, revealProgress, screenWidth, screenHeight }: NostrNodeProps) {
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
          withTiming(1.06, { duration: 2800 + index * 90, easing: Easing.inOut(Easing.sin) }),
          -1,
          true
        )
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        styles.nostrNode,
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

type NostrStepProps = {
  screenHeight: number
  screenWidth: number
}

function NostrStep({ screenWidth, screenHeight }: NostrStepProps) {
  const revealProgress = useSharedValue(0)
  const edgeOpacity = useSharedValue(0)
  const pulseOpacity = useSharedValue(1)

  const edgeStyle = useAnimatedStyle(() => ({ opacity: edgeOpacity.value }))
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }))

  useEffect(() => {
    revealProgress.set(
      withTiming(NOSTR_NODES.length, {
        duration: NOSTR_NODES.length * NOSTR_NODE_STAGGER_MS + NOSTR_NODE_REVEAL_MS,
        easing: Easing.out(Easing.cubic)
      }, () => {
        edgeOpacity.set(withTiming(1, { duration: NOSTR_EDGE_FADE_MS }))
        pulseOpacity.set(
          withRepeat(
            withTiming(NOSTR_PULSE_MIN, { duration: NOSTR_PULSE_MS, easing: Easing.inOut(Easing.sin) }),
            -1,
            true
          )
        )
      })
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.fullScreen, pulseStyle]} pointerEvents="none">
      <Animated.View style={[styles.fullScreen, edgeStyle]} pointerEvents="none">
        <Svg width={screenWidth} height={screenHeight}>
          {NOSTR_EDGES.map(([from, to], i) => {
            const a = NOSTR_NODES[from]
            const b = NOSTR_NODES[to]
            return (
              <Path
                key={i}
                d={`M ${a.cx * screenWidth} ${a.cy * screenHeight} L ${b.cx * screenWidth} ${b.cy * screenHeight}`}
                stroke="rgba(255,255,255,0.30)"
                strokeWidth={1}
              />
            )
          })}
        </Svg>
      </Animated.View>
      {NOSTR_NODES.map((node, i) => (
        <NostrNode
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

function sankeyBandPath(sw: number, sh: number, band: SankeyBand): string {
  const x1 = band.x1 * sw, t1 = band.t1 * sh, b1 = band.b1 * sh
  const x2 = band.x2 * sw, t2 = band.t2 * sh, b2 = band.b2 * sh
  const mx = (x1 + x2) / 2
  return `M ${x1} ${t1} C ${mx} ${t1} ${mx} ${t2} ${x2} ${t2} L ${x2} ${b2} C ${mx} ${b2} ${mx} ${b1} ${x1} ${b1} Z`
}

type SankeyLevelProps = {
  bands: SankeyBand[]
  levelOpacity: SharedValue<number>
  screenHeight: number
  screenWidth: number
}

function SankeyLevel({ bands, levelOpacity, screenWidth, screenHeight }: SankeyLevelProps) {
  const style = useAnimatedStyle(() => ({ opacity: levelOpacity.value }))

  return (
    <Animated.View style={[styles.fullScreen, style]} pointerEvents="none">
      <Svg width={screenWidth} height={screenHeight}>
        {bands.map((band, i) => (
          <Path
            key={i}
            d={sankeyBandPath(screenWidth, screenHeight, band)}
            fill={`rgba(255,255,255,${band.op})`}
          />
        ))}
      </Svg>
    </Animated.View>
  )
}

type SankeyStepProps = {
  screenHeight: number
  screenWidth: number
}

function SankeyStep({ screenWidth, screenHeight }: SankeyStepProps) {
  const level0 = useSharedValue(0)
  const level1 = useSharedValue(0)
  const level2 = useSharedValue(0)
  const pulseOpacity = useSharedValue(1)

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }))

  useEffect(() => {
    level0.set(withTiming(1, { duration: SANKEY_PHASE_MS, easing: Easing.out(Easing.cubic) }))
    level1.set(
      withDelay(SANKEY_PHASE_GAP_MS, withTiming(1, { duration: SANKEY_PHASE_MS, easing: Easing.out(Easing.cubic) }))
    )
    level2.set(
      withDelay(
        SANKEY_PHASE_GAP_MS * 2,
        withTiming(1, { duration: SANKEY_PHASE_MS, easing: Easing.out(Easing.cubic) }, () => {
          pulseOpacity.set(
            withRepeat(
              withTiming(SANKEY_PULSE_MIN, { duration: SANKEY_PULSE_MS, easing: Easing.inOut(Easing.sin) }),
              -1,
              true
            )
          )
        })
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.fullScreen, pulseStyle]} pointerEvents="none">
      <SankeyLevel bands={SANKEY_LEVEL_2} levelOpacity={level2} screenWidth={screenWidth} screenHeight={screenHeight} />
      <SankeyLevel bands={SANKEY_LEVEL_1} levelOpacity={level1} screenWidth={screenWidth} screenHeight={screenHeight} />
      <SankeyLevel bands={SANKEY_LEVEL_0} levelOpacity={level0} screenWidth={screenWidth} screenHeight={screenHeight} />
    </Animated.View>
  )
}

type PhoneUIElementProps = {
  children: ReactNode
  index: number
  uiReveal: SharedValue<number>
}

function PhoneUIElement({ children, index, uiReveal }: PhoneUIElementProps) {
  const animStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, uiReveal.value - index))
    return {
      opacity: progress,
      transform: [{ translateY: PHONE_SLIDE_Y * (1 - progress) }]
    }
  })

  return (
    <Animated.View style={[styles.phoneUIElement, animStyle]}>
      {children}
    </Animated.View>
  )
}

type PhoneLayerBtnProps = {
  highlightWave: SharedValue<number>
  index: number
  label: string
}

function PhoneLayerBtn({ label, index, highlightWave }: PhoneLayerBtnProps) {
  const borderGlowStyle = useAnimatedStyle(() => {
    const signed = highlightWave.value - index
    const t = signed < 0
      ? Math.max(0, 1 + signed * 2.5)  // fast rise
      : Math.max(0, 1 - signed * 0.35) // slow fade out
    return { opacity: t * 0.45 }
  })

  const textStyle = useAnimatedStyle(() => {
    const signed = highlightWave.value - index
    const t = signed < 0
      ? Math.max(0, 1 + signed * 2.5)  // fast rise
      : Math.max(0, 1 - signed * 0.35) // slow fade out
    return { opacity: 0.65 + t * 0.25 }
  })

  return (
    <View style={styles.phoneLayerBtn}>
      <Animated.View style={[styles.phoneLayerBtnBorder, borderGlowStyle]} pointerEvents="none" />
      <Animated.Text numberOfLines={1} style={[styles.phoneLayerBtnText, textStyle]}>
        {label}
      </Animated.Text>
    </View>
  )
}

function LayersStep() {
  const frameScale = useSharedValue(1)
  const uiReveal = useSharedValue(0)
  const highlightWave = useSharedValue(-1)

  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: frameScale.value }]
  }))

  useEffect(() => {
    frameScale.set(
      withTiming(PHONE_SCALE_TARGET, { duration: PHONE_SCALE_MS, easing: Easing.out(Easing.cubic) }, () => {
        uiReveal.set(
          withTiming(PHONE_UI_COUNT, {
            duration: PHONE_UI_COUNT * PHONE_STAGGER_MS + PHONE_FADE_MS,
            easing: Easing.linear
          }, () => {
            highlightWave.set(
              withRepeat(
                withSequence(
                  withDelay(
                    PHONE_HIGHLIGHT_PAUSE_MS,
                    withTiming(PHONE_UI_COUNT - 1, { duration: PHONE_HIGHLIGHT_SWEEP_MS, easing: Easing.linear })
                  ),
                  withTiming(-1, { duration: 1 })
                ),
                -1,
                false
              )
            )
          })
        )
      })
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.phoneFrame, frameStyle]} pointerEvents="none">
      <View style={styles.phoneBorder}>
        <PhoneUIElement index={0} uiReveal={uiReveal}>
          <PhoneLayerBtn label="Bitcoin" index={0} highlightWave={highlightWave} />
        </PhoneUIElement>
        <PhoneUIElement index={1} uiReveal={uiReveal}>
          <PhoneLayerBtn label="Lightning" index={1} highlightWave={highlightWave} />
        </PhoneUIElement>
        <PhoneUIElement index={2} uiReveal={uiReveal}>
          <PhoneLayerBtn label="Ark" index={2} highlightWave={highlightWave} />
        </PhoneUIElement>
        <PhoneUIElement index={3} uiReveal={uiReveal}>
          <PhoneLayerBtn label="eCash" index={3} highlightWave={highlightWave} />
        </PhoneUIElement>
        <PhoneUIElement index={4} uiReveal={uiReveal}>
          <PhoneLayerBtn label="Nostr" index={4} highlightWave={highlightWave} />
        </PhoneUIElement>
      </View>
    </Animated.View>
  )
}

type RingItemProps = {
  centerX: number
  centerY: number
  index: number
  opacity: number
  radius: number
  ringReveal: SharedValue<number>
}

function RingItem({ radius, centerX, centerY, opacity, index, ringReveal }: RingItemProps) {
  const breathe = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, ringReveal.value - index))
    const progress = raw * raw * (3 - 2 * raw)
    return {
      opacity: opacity * progress,
      transform: [{ scale: (0.25 + progress * 0.75) * breathe.value }]
    }
  })

  useEffect(() => {
    const phaseDelay = index * 340
    breathe.set(
      withDelay(
        phaseDelay,
        withRepeat(
          withTiming(PRIVACY_PULSE_SCALE, { duration: PRIVACY_PULSE_MS, easing: Easing.inOut(Easing.sin) }),
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

type PrivacyStepProps = {
  screenHeight: number
  screenWidth: number
}

function PrivacyStep({ screenWidth, screenHeight }: PrivacyStepProps) {
  const ringReveal = useSharedValue(0)

  useEffect(() => {
    ringReveal.set(
      withTiming(RING_DEFS.length, {
        duration: RING_DEFS.length * PRIVACY_STAGGER_MS + PRIVACY_REVEAL_MS,
        easing: Easing.linear
      })
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
            ringReveal={ringReveal}
          />
        )
      })}
    </View>
  )
}

type BlockTxProps = {
  blockLeft: number
  h: number
  scanX: SharedValue<number>
  w: number
  x: number
  y: number
}

function BlockTx({ blockLeft, scanX, x, y, w, h }: BlockTxProps) {
  const style = useAnimatedStyle(() => {
    // localPastBlock = 0 when scan line reaches right edge of block
    const localPastBlock = scanX.value - (blockLeft + EXPLORER_BLOCK_SIZE - 20)
    const fadeIn = Math.min(1, Math.max(0, localPastBlock / EXPLORER_SCAN_FADE_IN_PX))
    const fadeOut = Math.min(1, Math.max(0, (EXPLORER_SCAN_FADE_OUT_PX - localPastBlock) / EXPLORER_SCAN_FADE_OUT_PX))
    const t = Math.min(fadeIn, fadeOut)
    return { opacity: 0.1 + t * 0.6 }
  })

  return (
    <Animated.View style={[styles.explorerTx, style, { height: h, left: x, top: y, width: w }]} />
  )
}

type ExplorerStepProps = {
  screenHeight: number
  screenWidth: number
}

function ExplorerStep({ screenWidth, screenHeight }: ExplorerStepProps) {
  const revealOpacity = useSharedValue(0)
  const revealScale = useSharedValue(EXPLORER_REVEAL_SCALE)
  const scanX = useSharedValue(0)

  const containerStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
    transform: [{ scale: revealScale.value }]
  }))

  const scanStyle = useAnimatedStyle(() => {
    const fadeLeft = Math.min(1, scanX.value / EXPLORER_SCAN_EDGE_FADE_PX)
    const fadeRight = Math.min(1, (EXPLORER_CHAIN_WIDTH - scanX.value) / EXPLORER_SCAN_EDGE_FADE_PX)
    return {
      opacity: 0.55 * Math.min(fadeLeft, fadeRight),
      transform: [{ translateX: scanX.value }]
    }
  })

  const chainLeft = (screenWidth - EXPLORER_CHAIN_WIDTH) / 2
  const chainTop = screenHeight * EXPLORER_TOP_FRACTION

  useEffect(() => {
    revealOpacity.set(withTiming(1, { duration: EXPLORER_REVEAL_MS }))
    revealScale.set(
      withTiming(1, { duration: EXPLORER_REVEAL_MS, easing: Easing.out(Easing.cubic) }, () => {
        scanX.set(
          withRepeat(
            withTiming(EXPLORER_CHAIN_WIDTH, { duration: EXPLORER_SCAN_MS, easing: Easing.linear }),
            -1,
            false
          )
        )
      })
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.fullScreen, containerStyle]} pointerEvents="none">
      <View style={[styles.explorerChain, { left: chainLeft, top: chainTop }]}>
        {Array.from({ length: EXPLORER_BLOCK_COUNT }).map((_, i) => {
          const blockLeft = i * (EXPLORER_BLOCK_SIZE + EXPLORER_CONNECTOR_W)
          const blockCenterScreen = chainLeft + blockLeft + EXPLORER_BLOCK_SIZE / 2
          const edgeFadeLeft = Math.min(1, Math.max(0, blockCenterScreen / 120))
          const edgeFadeRight = Math.min(1, Math.max(0, (screenWidth - blockCenterScreen) / 120))
          const edgeFade = Math.max(0.18, Math.min(edgeFadeLeft, edgeFadeRight))
          return (
            <View key={i} style={[styles.explorerItem, { opacity: edgeFade }]}>
              <View style={styles.explorerBlock}>
                {EXPLORER_TX_DEFS[i].map((tx, j) => (
                  <BlockTx
                    key={j}
                    blockLeft={blockLeft}
                    scanX={scanX}
                    x={tx.x}
                    y={tx.y}
                    w={tx.w}
                    h={tx.h}
                  />
                ))}
              </View>
              {i < EXPLORER_BLOCK_COUNT - 1 && <View style={styles.explorerConnector} />}
            </View>
          )
        })}
        <Animated.View style={[styles.explorerScan, scanStyle]} />
      </View>
    </Animated.View>
  )
}

type RoadmapItemProps = {
  done: boolean
  index: number
  uiReveal: SharedValue<number>
}

function RoadmapItem({ done, index, uiReveal }: RoadmapItemProps) {
  const animStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, uiReveal.value - index))
    return {
      opacity: progress,
      transform: [{ translateY: ROADMAP_SLIDE_Y * (1 - progress) }]
    }
  })
  return (
    <Animated.View style={animStyle}>
      <View style={styles.roadmapRow}>
        <View style={[styles.roadmapDot, !done && styles.roadmapDotFuture]} />
        <View style={[styles.roadmapBar, !done && styles.roadmapBarFuture]} />
      </View>
    </Animated.View>
  )
}

type RoadmapStepProps = {
  screenHeight: number
  screenWidth: number
}

function RoadmapStep({ screenHeight, screenWidth }: RoadmapStepProps) {
  const uiReveal = useSharedValue(0)
  const lineH = useSharedValue(0)

  const lineStyle = useAnimatedStyle(() => ({ height: lineH.value }))

  const rowSpacing = screenHeight * ROADMAP_ROW_FRACTION
  const totalLineH = (ROADMAP_ITEM_COUNT - 1) * rowSpacing
  const totalDuration = ROADMAP_ITEM_COUNT * ROADMAP_STAGGER_MS + ROADMAP_FADE_MS

  useEffect(() => {
    uiReveal.set(withTiming(ROADMAP_ITEM_COUNT, { duration: totalDuration, easing: Easing.linear }))
    lineH.set(withTiming(totalLineH, { duration: totalDuration + 120, easing: Easing.out(Easing.cubic) }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startX = screenWidth * ROADMAP_LEFT_FRACTION
  const startY = screenHeight * ROADMAP_TOP_FRACTION

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      <View
        style={[styles.roadmapLineTrack, { left: startX + ROADMAP_DOT_SIZE / 2, top: startY + ROADMAP_DOT_SIZE / 2 }]}
      >
        <Animated.View style={[styles.roadmapLineFill, lineStyle]} />
      </View>
      {ROADMAP_ITEMS.map((item, i) => (
        <View key={i} style={{ left: startX, position: 'absolute', top: startY + i * rowSpacing }}>
          <RoadmapItem done={item.done} index={i} uiReveal={uiReveal} />
        </View>
      ))}
    </View>
  )
}

type ThanksStepProps = {
  screenHeight: number
  screenWidth: number
}

function ThanksStep({ screenWidth, screenHeight }: ThanksStepProps) {
  const revealScale = useSharedValue(THANKS_REVEAL_SCALE)
  const breathe = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: revealScale.value * breathe.value }]
  }))

  useEffect(() => {
    revealScale.set(
      withTiming(1, { duration: THANKS_REVEAL_MS, easing: Easing.out(Easing.back(1.2)) }, () => {
        breathe.set(
          withRepeat(
            withTiming(THANKS_BREATHE_MAX, { duration: THANKS_BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
            -1,
            true
          )
        )
      })
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.fullScreen, animStyle]} pointerEvents="none">
      {THANKS_CIRCLES.map((circle) => (
        <View
          key={`${circle.leftFraction}-${circle.topFraction}`}
          style={[
            styles.thanksCircle,
            {
              borderRadius: circle.size / 2,
              height: circle.size,
              left: circle.leftFraction * screenWidth - circle.size / 2,
              opacity: circle.opacity,
              top: circle.topFraction * screenHeight - circle.size / 2,
              width: circle.size
            }
          ]}
        />
      ))}
    </Animated.View>
  )
}

type SSIntroAnimationProps = {
  firstTime: boolean
  onComplete: () => void
}

function SSIntroAnimation({ firstTime, onComplete }: SSIntroAnimationProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const { bottom: bottomInset } = useSafeAreaInsets()

  const [currentStep, setCurrentStep] = useState(0)
  const [isLogoFinale, setIsLogoFinale] = useState(false)
  const stepSwitchingRef = useRef(false)

  const containerOpacity = useSharedValue(1)
  const circleScale = useSharedValue(0)
  const logoOpacity = useSharedValue(0)
  const stepTransition = useSharedValue(0)
  const stepOffsetX = useSharedValue(SLIDE_IN_OFFSET)
  const textSlideX = useSharedValue(SLIDE_IN_OFFSET)
  const descSlideX = useSharedValue(SLIDE_IN_OFFSET)

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value
  }))

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }]
  }))

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value
  }))

  const stepTextStyle = useAnimatedStyle(() => ({
    opacity: stepTransition.value,
    transform: [{ translateX: textSlideX.value }]
  }))

  const descTextStyle = useAnimatedStyle(() => ({
    opacity: stepTransition.value,
    transform: [{ translateX: descSlideX.value }]
  }))

  const stepContentStyle = useAnimatedStyle(() => ({
    opacity: stepTransition.value,
    transform: [{ translateX: stepOffsetX.value }]
  }))

  useEffect(() => {
    if (firstTime) {
      stepOffsetX.set(
        withTiming(0, { duration: TRANSITION_MS, easing: Easing.out(Easing.quad) })
      )
      textSlideX.set(
        withDelay(TEXT_SLIDE_DELAY, withTiming(0, { duration: TRANSITION_MS, easing: Easing.out(Easing.quad) }))
      )
      descSlideX.set(
        withDelay(DESC_SLIDE_DELAY, withTiming(0, { duration: TRANSITION_MS, easing: Easing.out(Easing.quad) }))
      )
      stepTransition.set(withTiming(1, { duration: TRANSITION_MS }))
    } else {
      circleScale.set(
        withTiming(1, {
          duration: RETURNING_CIRCLE_IN,
          easing: Easing.out(Easing.back(1.3))
        })
      )
      logoOpacity.set(
        withDelay(RETURNING_LOGO_DELAY, withTiming(1, { duration: RETURNING_LOGO_IN }))
      )
      containerOpacity.set(
        withDelay(
          RETURNING_FADE_DELAY,
          withTiming(0, { duration: RETURNING_FADE_OUT }, (finished) => {
            if (finished) {runOnJS(onComplete)()}
          })
        )
      )
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fires after React commits the new step — guarantees the old step is
  // already unmounted before the fade-in starts, preventing ghost flashes.
  useEffect(() => {
    if (!stepSwitchingRef.current) return
    stepSwitchingRef.current = false
    stepOffsetX.set(
      withTiming(0, { duration: TRANSITION_MS, easing: Easing.out(Easing.quad) })
    )
    textSlideX.set(
      withDelay(TEXT_SLIDE_DELAY, withTiming(0, { duration: TRANSITION_MS, easing: Easing.out(Easing.quad) }))
    )
    descSlideX.set(
      withDelay(DESC_SLIDE_DELAY, withTiming(0, { duration: TRANSITION_MS, easing: Easing.out(Easing.quad) }))
    )
    stepTransition.set(withTiming(1, { duration: TRANSITION_MS }))
  }, [currentStep]) // eslint-disable-line react-hooks/exhaustive-deps

  function startLogoFinale() {
    setIsLogoFinale(true)
    circleScale.set(
      withTiming(1, {
        duration: CIRCLE_IN_MS,
        easing: Easing.out(Easing.back(1.4))
      })
    )
    logoOpacity.set(
      withDelay(CIRCLE_IN_MS - LOGO_OVERLAP_MS, withTiming(1, { duration: LOGO_IN_MS }))
    )
    containerOpacity.set(
      withDelay(
        CIRCLE_IN_MS + LOGO_IN_MS + LOGO_HOLD_MS,
        withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
          if (finished) {runOnJS(onComplete)()}
        })
      )
    )
  }

  function advanceFromStep(step: number) {
    const next = step + 1

    if (next >= STEP_COUNT) {
      startLogoFinale()
      return
    }

    stepOffsetX.value = SLIDE_IN_OFFSET
    textSlideX.value = SLIDE_IN_OFFSET
    descSlideX.value = SLIDE_IN_OFFSET
    stepSwitchingRef.current = true
    setCurrentStep(next)
  }

  function goBackFromStep(step: number) {
    const prev = step - 1
    stepOffsetX.value = SLIDE_OUT_OFFSET
    textSlideX.value = SLIDE_OUT_OFFSET
    descSlideX.value = SLIDE_OUT_OFFSET
    stepSwitchingRef.current = true
    setCurrentStep(prev)
  }

  function handleNext() {
    const step = currentStep
    textSlideX.set(withTiming(SLIDE_OUT_OFFSET, { duration: TRANSITION_MS }))
    descSlideX.set(withTiming(SLIDE_OUT_OFFSET, { duration: TRANSITION_MS }))
    stepOffsetX.set(withTiming(SLIDE_OUT_OFFSET, { duration: TRANSITION_MS }))
    stepTransition.set(
      withTiming(0, { duration: TRANSITION_MS }, (finished) => {
        if (finished) {runOnJS(advanceFromStep)(step)}
      })
    )
  }

  function handleBack() {
    const step = currentStep
    textSlideX.set(withTiming(SLIDE_IN_OFFSET, { duration: TRANSITION_MS }))
    descSlideX.set(withTiming(SLIDE_IN_OFFSET, { duration: TRANSITION_MS }))
    stepOffsetX.set(withTiming(SLIDE_IN_OFFSET, { duration: TRANSITION_MS }))
    stepTransition.set(
      withTiming(0, { duration: TRANSITION_MS }, (finished) => {
        if (finished) {runOnJS(goBackFromStep)(step)}
      })
    )
  }

  function handleSkip() {
    containerOpacity.value = 0
    onComplete()
  }

  const isLastStep = currentStep === STEP_COUNT - 1
  const safeBottom = Math.max(bottomInset, MIN_BOTTOM_PADDING)

  return (
    <Animated.View style={[styles.overlay, containerStyle]}>
      {firstTime && !isLogoFinale && (
        <>
        <Animated.View
          style={[styles.fullScreen, stepContentStyle]}
          pointerEvents="box-none"
        >
          {currentStep === 0 && (
            <HexStreamStep screenWidth={screenWidth} screenHeight={screenHeight} />
          )}
          {currentStep === 1 && (
            <BubbleStep screenWidth={screenWidth} screenHeight={screenHeight} />
          )}
          {currentStep === 2 && (
            <SankeyStep screenWidth={screenWidth} screenHeight={screenHeight} />
          )}
          {currentStep === 3 && (
            <LayersStep />
          )}
          {currentStep === 4 && (
            <PrivacyStep screenWidth={screenWidth} screenHeight={screenHeight} />
          )}
          {currentStep === 5 && (
            <NostrStep screenWidth={screenWidth} screenHeight={screenHeight} />
          )}
          {currentStep === 6 && (
            <ExplorerStep screenWidth={screenWidth} screenHeight={screenHeight} />
          )}
          {currentStep === 7 && (
            <RoadmapStep screenWidth={screenWidth} screenHeight={screenHeight} />
          )}
          {currentStep === 8 && (
            <ThanksStep screenWidth={screenWidth} screenHeight={screenHeight} />
          )}

          <LinearGradient
            colors={['transparent', Colors.gray[950]]}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
        </Animated.View>

        <View style={[styles.satsignerLabel, { bottom: safeBottom + 280 }]}>
          <Text style={styles.welcomeText}>{'SATSIGNER'}</Text>
        </View>

        <View style={[styles.titleBlock, { bottom: safeBottom + 172 }]}>
          <Animated.View style={stepTextStyle}>
            <SSText size="xl" style={styles.stepTitle}>
              {t(STEP_CONFIGS[currentStep].titleKey)}
            </SSText>
          </Animated.View>
          <Animated.View style={descTextStyle}>
            <SSText color="muted" size="sm" style={styles.stepDescription}>
              {t(STEP_CONFIGS[currentStep].descriptionKey)}
            </SSText>
          </Animated.View>
        </View>

        <View style={[styles.persistentButtons, { paddingBottom: safeBottom }]}>
          <View style={[styles.dots, styles.dotsSpaced]}>
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentStep && styles.dotActive]}
              />
            ))}
          </View>
          {isLastStep ? (
            <View style={styles.bottomRow}>
              <View style={styles.sideButton}>
                <SSButton
                  variant="outline"
                  label={t('intro.support')}
                  onPress={handleSkip}
                />
              </View>
              <View style={styles.sideButton}>
                <SSButton
                  variant="outline"
                  label={t('intro.finish')}
                  onPress={handleNext}
                />
              </View>
            </View>
          ) : (
            <SSButton
              variant="secondary"
              label={t('common.next')}
              onPress={handleNext}
            />
          )}
          <View style={styles.bottomRow}>
            {currentStep > 0 && (
              <View style={styles.sideButton}>
                <SSButton
                  variant="ghost"
                  label={t('common.back')}
                  onPress={handleBack}
                  uppercase={false}
                />
              </View>
            )}
            {!isLastStep && (
              <View style={styles.sideButton}>
                <SSButton
                  variant="ghost"
                  label={t('common.skip')}
                  onPress={handleSkip}
                  uppercase={false}
                />
              </View>
            )}
          </View>
        </View>
        </>
      )}

      <Animated.View style={[styles.logoWrapper, circleStyle]}>
        <View style={styles.logoCircle}>
          <Animated.View style={logoStyle}>
            <Text style={styles.logoText}>{'SAT\nSIGNER'}</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bottomGradient: {
    bottom: 0,
    height: '55%',
    left: 0,
    position: 'absolute',
    right: 0
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 8
  },
  persistentButtons: {
    bottom: 0,
    gap: 12,
    left: 0,
    paddingHorizontal: 24,
    position: 'absolute',
    right: 0
  },
  bubble: {
    backgroundColor: Colors.white,
    position: 'absolute'
  },
  dot: {
    backgroundColor: Colors.gray[600],
    borderRadius: DOT_SIZE / 2,
    height: DOT_SIZE,
    width: DOT_SIZE
  },
  dotActive: {
    backgroundColor: Colors.white
  },
  dots: {
    flexDirection: 'row',
    gap: DOT_GAP,
    justifyContent: 'center'
  },
  dotsSpaced: {
    marginBottom: 18
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject
  },
  hexClip: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0
  },
  hexText: {
    fontFamily: 'TerminessNerdFontMono-Regular',
    fontSize: HEX_FONT_SIZE,
    left: HEX_LEFT_PADDING,
    position: 'absolute'
  },
  logoCircle: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: LOGO_SIZE / 2,
    height: LOGO_SIZE,
    justifyContent: 'center',
    width: LOGO_SIZE
  },
  logoText: {
    color: Colors.black,
    fontFamily: Typography.sfProTextLight,
    fontSize: LOGO_FONT_SIZE,
    letterSpacing: LOGO_LETTER_SPACING,
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: Colors.gray[950],
    justifyContent: 'center',
    zIndex: 9999
  },
  explorerBlock: {
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    height: EXPLORER_BLOCK_SIZE,
    overflow: 'hidden',
    width: EXPLORER_BLOCK_SIZE
  },
  explorerTx: {
    backgroundColor: Colors.white,
    position: 'absolute'
  },
  explorerChain: {
    alignItems: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'absolute'
  },
  explorerConnector: {
    backgroundColor: Colors.white,
    height: 1,
    opacity: 0.2,
    width: EXPLORER_CONNECTOR_W
  },
  explorerItem: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  explorerScan: {
    backgroundColor: Colors.white,
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: 2
  },
  phoneBorder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.gray[950],
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: PHONE_FRAME_RADIUS,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: PHONE_HEADER_TOP
  },
  phoneFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PHONE_FRAME_RADIUS,
    elevation: 24,
    shadowColor: Colors.white,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 32
  },
  phoneLayerBtnBorder: {
    ...StyleSheet.absoluteFillObject,
    borderColor: Colors.white,
    borderRadius: 6,
    borderWidth: 1
  },
  phoneUIElement: {
    alignSelf: 'stretch'
  },
  phoneLayerBtn: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 6,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center'
  },
  phoneLayerBtnText: {
    color: 'rgba(255,255,255,0.65)',
    fontFamily: Typography.sfProTextLight,
    fontSize: 16,
    textTransform: 'uppercase'
  },
  nostrNode: {
    backgroundColor: Colors.white,
    position: 'absolute'
  },
  ring: {
    borderColor: Colors.white,
    borderWidth: 1,
    position: 'absolute'
  },
  sideButton: {
    flex: 1
  },
  welcomeText: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: Typography.sfProTextLight,
    fontSize: 11,
    letterSpacing: 3,
    textAlign: 'center'
  },
  satsignerLabel: {
    left: 0,
    position: 'absolute',
    right: 0
  },
  titleBlock: {
    gap: 8,
    left: 0,
    paddingHorizontal: 24,
    position: 'absolute',
    right: 0
  },
  stepDescription: {
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 12
  },
  stepTitle: {
    fontFamily: Typography.sfProTextLight,
    textAlign: 'center'
  },
  roadmapBar: {
    backgroundColor: Colors.white,
    borderRadius: 3,
    height: 7,
    opacity: 0.55,
    width: 110
  },
  roadmapBarFuture: {
    opacity: 0.18
  },
  roadmapDot: {
    backgroundColor: Colors.white,
    borderRadius: ROADMAP_DOT_SIZE / 2,
    height: ROADMAP_DOT_SIZE,
    opacity: 0.85,
    width: ROADMAP_DOT_SIZE
  },
  roadmapDotFuture: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
    opacity: 1
  },
  roadmapLineFill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 1
  },
  roadmapLineTrack: {
    overflow: 'hidden',
    position: 'absolute',
    width: 1
  },
  roadmapRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14
  },
  thanksCircle: {
    borderColor: Colors.white,
    borderWidth: 1,
    position: 'absolute'
  }
})

export default SSIntroAnimation
