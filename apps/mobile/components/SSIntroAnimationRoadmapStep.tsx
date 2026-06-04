import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'

import { Colors } from '@/styles'

const ROADMAP_ITEM_COUNT = 5
const ROADMAP_STAGGER_MS = 110
const ROADMAP_FADE_MS = 280
const ROADMAP_SLIDE_Y = 12
const ROADMAP_DOT_SIZE = 10
const ROADMAP_ROW_FRACTION = 0.1
const ROADMAP_TOP_FRACTION = 0.1
const ROADMAP_LEFT_FRACTION = 0.22

const ROADMAP_ITEMS = [
  { done: true },
  { done: true },
  { done: true },
  { done: false },
  { done: false }
] as const

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

type SSIntroAnimationRoadmapStepProps = {
  screenHeight: number
  screenWidth: number
}

function SSIntroAnimationRoadmapStep({
  screenHeight,
  screenWidth
}: SSIntroAnimationRoadmapStepProps) {
  const uiReveal = useSharedValue(0)
  const lineH = useSharedValue(0)

  const lineStyle = useAnimatedStyle(() => ({ height: lineH.value }))

  const rowSpacing = screenHeight * ROADMAP_ROW_FRACTION
  const totalLineH = (ROADMAP_ITEM_COUNT - 1) * rowSpacing
  const totalDuration =
    ROADMAP_ITEM_COUNT * ROADMAP_STAGGER_MS + ROADMAP_FADE_MS

  useEffect(() => {
    uiReveal.set(
      withTiming(ROADMAP_ITEM_COUNT, {
        duration: totalDuration,
        easing: Easing.linear
      })
    )
    lineH.set(
      withTiming(totalLineH, {
        duration: totalDuration + 120,
        easing: Easing.out(Easing.cubic)
      })
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startX = screenWidth * ROADMAP_LEFT_FRACTION
  const startY = screenHeight * ROADMAP_TOP_FRACTION

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      <View
        style={[
          styles.roadmapLineTrack,
          {
            left: startX + ROADMAP_DOT_SIZE / 2,
            top: startY + ROADMAP_DOT_SIZE / 2
          }
        ]}
      >
        <Animated.View style={[styles.roadmapLineFill, lineStyle]} />
      </View>
      {ROADMAP_ITEMS.map((item, i) => (
        <View
          key={i}
          style={{
            left: startX,
            position: 'absolute',
            top: startY + i * rowSpacing
          }}
        >
          <RoadmapItem done={item.done} index={i} uiReveal={uiReveal} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject
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
  }
})

export default SSIntroAnimationRoadmapStep
