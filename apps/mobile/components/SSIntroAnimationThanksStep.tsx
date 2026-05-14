import { useEffect } from 'react'
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

const LOGO_SIZE = 140
const LOGO_FONT_SIZE = 21
const LOGO_LETTER_SPACING = 4
const LOGO_FONT_LINE_HEIGHT = 23

const THANKS_LOGO_REVEAL_MS = 500
const THANKS_NODE_STAGGER_MS = 70
const THANKS_NODE_REVEAL_MS = 320
const THANKS_BREATHE_MAX = 1.04
const THANKS_BREATHE_MS = 3400

// Contributor circles orbit the logo (logo center: cx=0.5, cy=0.28)
const THANKS_CONTRIBUTOR_NODES = [
  { cx: 0.5, cy: 0.16, github: 'francismars', opacity: 0.88, size: 44 },
  { cx: 0.66, cy: 0.2, github: 'garyray-k', opacity: 0.84, size: 40 },
  { cx: 0.72, cy: 0.28, github: 'Jeezman', opacity: 0.86, size: 42 },
  { cx: 0.66, cy: 0.36, github: 'tmakerman', opacity: 0.82, size: 40 },
  { cx: 0.5, cy: 0.4, github: 'pedromvprg', opacity: 0.88, size: 44 },
  { cx: 0.34, cy: 0.36, github: 'psycarlo1', opacity: 0.82, size: 40 },
  { cx: 0.28, cy: 0.28, github: 'dergigi', opacity: 0.84, size: 42 },
  { cx: 0.34, cy: 0.2, github: 'NerdNook-rgb', opacity: 0.8, size: 38 }
] as const

// Outer orbit — larger circles for supporting organization logos
const THANKS_COMPANY_NODES = [
  { cx: 0.12, cy: 0.28, opacity: 0.55, size: 60 },
  { cx: 0.88, cy: 0.28, opacity: 0.55, size: 60 }
] as const

const THANKS_TOTAL_NODE_COUNT =
  THANKS_CONTRIBUTOR_NODES.length + THANKS_COMPANY_NODES.length

type ThanksNodeProps = {
  breathe: SharedValue<number>
  finaleProgress: SharedValue<number>
  index: number
  nodeReveal: SharedValue<number>
  screenHeight: number
  screenWidth: number
}

function ThanksNode({
  index,
  nodeReveal,
  breathe,
  finaleProgress,
  screenWidth,
  screenHeight
}: ThanksNodeProps) {
  const node = THANKS_CONTRIBUTOR_NODES[index]
  const { size } = node

  const animStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, nodeReveal.value - index))
    const progress = raw * raw * (3 - 2 * raw)
    return {
      opacity: node.opacity * progress * (1 - finaleProgress.value),
      transform: [{ scale: (0.5 + progress * 0.5) * breathe.value }]
    }
  })

  return (
    <Animated.View
      style={[
        styles.thanksCircle,
        animStyle,
        {
          borderRadius: size / 2,
          height: size,
          left: node.cx * screenWidth - size / 2,
          overflow: 'hidden',
          top: node.cy * screenHeight - size / 2,
          width: size
        }
      ]}
    >
      <Image
        source={{ uri: `https://github.com/${node.github}.png?size=80` }}
        style={{ height: size, width: size }}
      />
    </Animated.View>
  )
}

type ThanksCompanyNodeProps = {
  breathe: SharedValue<number>
  finaleProgress: SharedValue<number>
  index: number
  nodeReveal: SharedValue<number>
  screenHeight: number
  screenWidth: number
}

function ThanksCompanyNode({
  index,
  nodeReveal,
  breathe,
  finaleProgress,
  screenWidth,
  screenHeight
}: ThanksCompanyNodeProps) {
  const node = THANKS_COMPANY_NODES[index]
  const { size } = node
  const nodeIndex = THANKS_CONTRIBUTOR_NODES.length + index

  const animStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, nodeReveal.value - nodeIndex))
    const progress = raw * raw * (3 - 2 * raw)
    return {
      opacity: node.opacity * progress * (1 - finaleProgress.value),
      transform: [{ scale: (0.5 + progress * 0.5) * breathe.value }]
    }
  })

  return (
    <Animated.View
      style={[
        styles.thanksCircle,
        animStyle,
        {
          borderRadius: size / 2,
          height: size,
          left: node.cx * screenWidth - size / 2,
          top: node.cy * screenHeight - size / 2,
          width: size
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
  const logoReveal = useSharedValue(0)
  const nodeReveal = useSharedValue(0)
  const breathe = useSharedValue(1)

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoReveal.value,
    transform: [
      {
        scale:
          (0.7 + logoReveal.value * 0.3) * (1 + finaleProgress.value * 0.06)
      }
    ]
  }))

  useEffect(() => {
    logoReveal.set(
      withTiming(
        1,
        {
          duration: THANKS_LOGO_REVEAL_MS,
          easing: Easing.out(Easing.back(1.2))
        },
        () => {
          nodeReveal.set(
            withTiming(
              THANKS_TOTAL_NODE_COUNT,
              {
                duration:
                  THANKS_TOTAL_NODE_COUNT * THANKS_NODE_STAGGER_MS +
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const logoLeft = screenWidth / 2 - LOGO_SIZE / 2
  const logoTop = screenHeight * 0.28 - LOGO_SIZE / 2

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {THANKS_CONTRIBUTOR_NODES.map((_, i) => (
        <ThanksNode
          key={i}
          index={i}
          nodeReveal={nodeReveal}
          breathe={breathe}
          finaleProgress={finaleProgress}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}
      {THANKS_COMPANY_NODES.map((_, i) => (
        <ThanksCompanyNode
          key={`company-${i}`}
          index={i}
          nodeReveal={nodeReveal}
          breathe={breathe}
          finaleProgress={finaleProgress}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}
      <Animated.View
        style={[
          styles.thanksLogoWrapper,
          logoStyle,
          { left: logoLeft, top: logoTop }
        ]}
      >
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>{'SAT\nSIGNER'}</Text>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject
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
    fontFamily: Typography.sfProTextRegular,
    fontSize: LOGO_FONT_SIZE,
    letterSpacing: LOGO_LETTER_SPACING,
    lineHeight: LOGO_FONT_LINE_HEIGHT,
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  thanksCircle: {
    borderColor: Colors.white,
    borderWidth: 1,
    position: 'absolute'
  },
  thanksLogoWrapper: {
    position: 'absolute'
  }
})

export default SSIntroAnimationThanksStep
