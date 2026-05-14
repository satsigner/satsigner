import { hierarchy, pack } from 'd3'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  runOnJS
} from 'react-native-reanimated'

import { Colors } from '@/styles'

const { 200: BUBBLE_COLOR_BRIGHT, 700: BUBBLE_COLOR_DARK } = Colors.gray
const BUBBLE_COLOR_THRESHOLD = 0.45

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
const UTXO_REPACK_MS = 280

// UTXO value pool — used to randomly sample bubble sizes (proportional to
// sqrt of value). Larger bubbles = larger UTXOs (dominant holdings); smaller =
// dust/change outputs.
const UTXO_VALUE_POOL = [
  900, 600, 450, 320, 250, 200, 160, 130, 100, 80, 60, 45, 35, 25, 18, 12, 8, 5
] as const

let _utxoBubbleIdCounter = 0

function nextUtxoBubbleId(): number {
  const id = _utxoBubbleIdCounter
  _utxoBubbleIdCounter += 1
  return id
}

type LiveUtxoBubble = {
  enterDelay: number
  exiting: boolean
  id: number
  value: number
}

type PackedUtxoBubble = {
  color: string
  cx: number
  cy: number
  enterDelay: number
  exiting: boolean
  id: number
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
  if (bubbles.length === 0) {
    return []
  }

  const packW = screenWidth * 0.9
  const packH = screenHeight * 0.48
  const offsetX = (screenWidth - packW) / 2
  const offsetY = screenHeight * 0.12

  const root = hierarchy<BubblePackDatum>({
    children: bubbles.map((b) => ({ id: b.id, value: b.value })),
    id: -1,
    value: 0
  })
    .sum((d) => d.value)
    // eslint-disable-next-line unicorn/no-array-sort -- toSorted not supported in Hermes
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const packer = pack<BubblePackDatum>()
    .size([packW, packH])
    .padding(UTXO_PACK_PADDING)
  const leaves = packer(root).leaves()
  const maxR = Math.max(...leaves.map((l) => l.r), 1)

  return leaves.map((leaf) => {
    const bubble = bubbles.find((b) => b.id === leaf.data.id)!
    return {
      color:
        leaf.r / maxR >= BUBBLE_COLOR_THRESHOLD
          ? BUBBLE_COLOR_BRIGHT
          : BUBBLE_COLOR_DARK,
      cx: leaf.x + offsetX,
      cy: leaf.y + offsetY,
      enterDelay: bubble.enterDelay,
      exiting: bubble.exiting,
      id: leaf.data.id,
      r: leaf.r
    }
  })
}

type LiveBubbleItemProps = {
  color: string
  cx: number
  cy: number
  enterDelay: number
  exiting: boolean
  id: number
  onExited: (id: number) => void
  r: number
}

function LiveBubbleItem({
  id,
  cx,
  cy,
  r,
  color,
  enterDelay,
  exiting,
  onExited
}: LiveBubbleItemProps) {
  const scaleAnim = useSharedValue(0)
  const xAnim = useSharedValue(cx)
  const yAnim = useSharedValue(cy)
  const breathe = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
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
        withTiming(
          1,
          { duration: UTXO_ENTER_MS, easing: Easing.out(Easing.cubic) },
          () => {
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
          }
        )
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (exiting) {
      breathe.set(withTiming(1, { duration: 80 }))
      scaleAnim.set(
        withTiming(
          0,
          { duration: UTXO_EXIT_MS, easing: Easing.in(Easing.cubic) },
          () => {
            runOnJS(onExited)(id)
          }
        )
      )
    }
  }, [exiting]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    xAnim.set(
      withTiming(cx, {
        duration: UTXO_REPACK_MS,
        easing: Easing.inOut(Easing.quad)
      })
    )
    yAnim.set(
      withTiming(cy, {
        duration: UTXO_REPACK_MS,
        easing: Easing.inOut(Easing.quad)
      })
    )
  }, [cx, cy]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        styles.bubble,
        animStyle,
        {
          backgroundColor: color,
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

type SSIntroAnimationBubbleStepProps = {
  screenHeight: number
  screenWidth: number
}

function SSIntroAnimationBubbleStep({
  screenWidth,
  screenHeight
}: SSIntroAnimationBubbleStepProps) {
  const initialBubbles = useRef<LiveUtxoBubble[] | null>(null)
  if (!initialBubbles.current) {
    // Sort descending so largest bubble appears first, smaller ones follow
    const picked = [...UTXO_VALUE_POOL]
      // eslint-disable-next-line unicorn/no-array-sort -- toSorted not supported in Hermes
      .sort(() => Math.random() - 0.5)
      .slice(0, 9)
      // eslint-disable-next-line unicorn/no-array-sort -- toSorted not supported in Hermes
      .sort((a, b) => b - a)
    initialBubbles.current = picked.map((value, index) => ({
      enterDelay: index * UTXO_ENTER_STAGGER_MS,
      exiting: false,
      id: nextUtxoBubbleId(),
      value
    }))
  }

  const [bubbles, setBubbles] = useState<LiveUtxoBubble[]>(
    initialBubbles.current
  )
  const packed = computePackedBubbles(bubbles, screenWidth, screenHeight)

  function handleExited(id: number) {
    setBubbles((prev) => prev.filter((b) => b.id !== id))
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setBubbles((prev) => {
        const active = prev.filter((b) => !b.exiting)
        const removeCount = Math.min(
          Math.floor(Math.random() * UTXO_REMOVE_MAX) + 1,
          Math.max(0, active.length - UTXO_MIN_COUNT)
        )
        const addCount = Math.min(
          Math.floor(Math.random() * (UTXO_ADD_MAX + 1)),
          UTXO_MAX_COUNT - (active.length - removeCount)
        )

        // eslint-disable-next-line unicorn/no-array-sort -- toSorted not supported in Hermes
        const shuffled = [...active].sort(() => Math.random() - 0.5)
        const toRemoveIds = new Set(
          shuffled.slice(0, removeCount).map((b) => b.id)
        )
        const newBubbles: LiveUtxoBubble[] = Array.from(
          { length: addCount },
          () => ({
            enterDelay: 0,
            exiting: false,
            id: nextUtxoBubbleId(),
            value:
              UTXO_VALUE_POOL[
                Math.floor(Math.random() * UTXO_VALUE_POOL.length)
              ]
          })
        )

        return [
          ...prev.map((b) =>
            toRemoveIds.has(b.id) ? { ...b, exiting: true } : b
          ),
          ...newBubbles
        ]
      })
    }, UTXO_CYCLE_MS)

    return () => clearInterval(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {packed.map((b) => (
        <LiveBubbleItem
          key={b.id}
          id={b.id}
          cx={b.cx}
          cy={b.cy}
          r={b.r}
          color={b.color}
          enterDelay={b.enterDelay}
          exiting={b.exiting}
          onExited={handleExited}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: Colors.white,
    position: 'absolute'
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject
  }
})

export default SSIntroAnimationBubbleStep
