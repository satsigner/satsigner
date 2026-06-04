import { type ReactNode, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'

import { Colors, Typography } from '@/styles'

const PHONE_SCALE_INITIAL = 0.92
const PHONE_SCALE_TARGET = 0.68
const PHONE_SCALE_MS = 500
const PHONE_UI_COUNT = 5
const PHONE_STAGGER_MS = 90
const PHONE_FADE_MS = 280
const PHONE_SLIDE_Y = 16
const PHONE_FRAME_RADIUS = 32
const PHONE_HEADER_TOP = 110
const PHONE_HIGHLIGHT_SWEEP_MS =
  PHONE_UI_COUNT * PHONE_STAGGER_MS + PHONE_FADE_MS
const PHONE_HIGHLIGHT_TAIL = 5 // must match 1 / fade-slope (0.20) in PhoneLayerBtn
const PHONE_HIGHLIGHT_TAIL_MS =
  PHONE_HIGHLIGHT_TAIL * (PHONE_HIGHLIGHT_SWEEP_MS / PHONE_UI_COUNT)
const PHONE_HIGHLIGHT_PAUSE_MS = 4500
const PHONE_SHADOW_FADE_IN_MS = 400
const PHONE_SHADOW_OPACITY = 0.42

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
    const t =
      signed < 0
        ? Math.max(0, 1 + signed * 1.4)
        : Math.max(0, 1 - signed * 0.2)
    return { opacity: t * 0.7 }
  })

  const textStyle = useAnimatedStyle(() => {
    const signed = highlightWave.value - index
    const t =
      signed < 0
        ? Math.max(0, 1 + signed * 1.4)
        : Math.max(0, 1 - signed * 0.2)
    return { opacity: 0.72 + t * 0.28 }
  })

  return (
    <View style={styles.phoneLayerBtn}>
      <Animated.View
        style={[styles.phoneLayerBtnBorder, borderGlowStyle]}
        pointerEvents="none"
      />
      <Animated.Text
        numberOfLines={1}
        style={[styles.phoneLayerBtnText, textStyle]}
      >
        {label}
      </Animated.Text>
    </View>
  )
}

type SSIntroAnimationLayersStepProps = {
  stepTransition: SharedValue<number>
}

function SSIntroAnimationLayersStep({
  stepTransition
}: SSIntroAnimationLayersStepProps) {
  const frameScale = useSharedValue(PHONE_SCALE_INITIAL)
  const shadowAnim = useSharedValue(0)
  const uiReveal = useSharedValue(0)
  const highlightWave = useSharedValue(-1)

  const frameStyle = useAnimatedStyle(() => ({
    shadowOpacity:
      PHONE_SHADOW_OPACITY *
      shadowAnim.value *
      Math.min(1, stepTransition.value * 3),
    transform: [{ scale: frameScale.value }]
  }))

  const contentFadeStyle = useAnimatedStyle(() => ({
    opacity: stepTransition.value
  }))

  useEffect(() => {
    frameScale.set(
      withTiming(
        PHONE_SCALE_TARGET,
        { duration: PHONE_SCALE_MS, easing: Easing.out(Easing.cubic) },
        () => {
          shadowAnim.set(withTiming(1, { duration: PHONE_SHADOW_FADE_IN_MS }))
          uiReveal.set(
            withTiming(
              PHONE_UI_COUNT,
              {
                duration: PHONE_UI_COUNT * PHONE_STAGGER_MS + PHONE_FADE_MS,
                easing: Easing.linear
              },
              () => {
                highlightWave.set(
                  withRepeat(
                    withSequence(
                      withDelay(
                        PHONE_HIGHLIGHT_PAUSE_MS,
                        withSequence(
                          withTiming(PHONE_UI_COUNT - 1, {
                            duration: PHONE_HIGHLIGHT_SWEEP_MS,
                            easing: Easing.linear
                          }),
                          withTiming(
                            PHONE_UI_COUNT - 1 + PHONE_HIGHLIGHT_TAIL,
                            {
                              duration: PHONE_HIGHLIGHT_TAIL_MS,
                              easing: Easing.linear
                            }
                          )
                        )
                      ),
                      withTiming(-1, { duration: 1 })
                    ),
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[styles.phoneFrame, frameStyle]} pointerEvents="none">
      <Animated.View
        style={[StyleSheet.absoluteFillObject, contentFadeStyle]}
      >
        <View style={styles.phoneBorder}>
          <PhoneUIElement index={0} uiReveal={uiReveal}>
            <PhoneLayerBtn
              label="Bitcoin"
              index={0}
              highlightWave={highlightWave}
            />
          </PhoneUIElement>
          <PhoneUIElement index={1} uiReveal={uiReveal}>
            <PhoneLayerBtn
              label="Lightning"
              index={1}
              highlightWave={highlightWave}
            />
          </PhoneUIElement>
          <PhoneUIElement index={2} uiReveal={uiReveal}>
            <PhoneLayerBtn
              label="Ark"
              index={2}
              highlightWave={highlightWave}
            />
          </PhoneUIElement>
          <PhoneUIElement index={3} uiReveal={uiReveal}>
            <PhoneLayerBtn
              label="eCash"
              index={3}
              highlightWave={highlightWave}
            />
          </PhoneUIElement>
          <PhoneUIElement index={4} uiReveal={uiReveal}>
            <PhoneLayerBtn
              label="Nostr"
              index={4}
              highlightWave={highlightWave}
            />
          </PhoneUIElement>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  phoneBorder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.gray[950],
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: PHONE_FRAME_RADIUS,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: PHONE_HEADER_TOP
  },
  phoneFrame: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.gray[950],
    borderRadius: PHONE_FRAME_RADIUS,
    elevation: 24,
    shadowColor: Colors.white,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0,
    shadowRadius: 32
  },
  phoneLayerBtn: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.32)',
    borderRadius: 3,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center'
  },
  phoneLayerBtnBorder: {
    ...StyleSheet.absoluteFillObject,
    borderColor: Colors.white,
    borderRadius: 3,
    borderWidth: 1
  },
  phoneLayerBtnText: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: Typography.sfProTextLight,
    fontSize: 16,
    letterSpacing: 3,
    textTransform: 'uppercase'
  },
  phoneUIElement: {
    alignSelf: 'stretch'
  }
})

export default SSIntroAnimationLayersStep
