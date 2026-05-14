import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import SSButton from '@/components/SSButton'
import SSIntroAnimationBubbleStep from '@/components/SSIntroAnimationBubbleStep'
import SSIntroAnimationCoordinationStep from '@/components/SSIntroAnimationCoordinationStep'
import SSIntroAnimationExplorerStep from '@/components/SSIntroAnimationExplorerStep'
import SSIntroAnimationHexStreamStep from '@/components/SSIntroAnimationHexStreamStep'
import SSIntroAnimationLayersStep from '@/components/SSIntroAnimationLayersStep'
import SSIntroAnimationPrivacyStep from '@/components/SSIntroAnimationPrivacyStep'
import SSIntroAnimationRoadmapStep from '@/components/SSIntroAnimationRoadmapStep'
import SSIntroAnimationSankeyStep from '@/components/SSIntroAnimationSankeyStep'
import SSIntroAnimationSaveSpendStep, {
  SSIntroAnimationSaveSpendFollowUpStep
} from '@/components/SSIntroAnimationSaveSpendStep'
import SSIntroAnimationThanksStep from '@/components/SSIntroAnimationThanksStep'
import SSText from '@/components/SSText'
import { t } from '@/locales'
import { Colors, Typography } from '@/styles'

// Logo / circle
const LOGO_SIZE = 140
const LOGO_FONT_SIZE = 21
const LOGO_LETTER_SPACING = 4
const LOGO_FONT_LINE_HEIGHT = 23

// Step dots / layout
const DOT_SIZE = 6
const DOT_GAP = 8
const STEP_COUNT = 11
const MIN_BOTTOM_PADDING = 24

// Step transition timing (ms / px)
const TRANSITION_MS = 320
const SLIDE_OUT_OFFSET = -24
const SLIDE_IN_OFFSET = 32
const TEXT_SLIDE_DELAY = 40
const DESC_SLIDE_DELAY = 90

// Logo finale timing (ms)
const CIRCLE_IN_MS = 500
const LOGO_IN_MS = 400
const LOGO_OVERLAP_MS = 200
const LOGO_HOLD_MS = 400
const FADE_OUT_MS = 400

// Thanks finale timing (ms)
const THANKS_FINALE_UI_FADE_MS = 350
const THANKS_FINALE_DURATION_MS = 650
const THANKS_FINALE_HOLD_MS = 500
const THANKS_FINALE_OUT_MS = 500

// Returning user timing (ms)
const RETURNING_CIRCLE_IN = 400
const RETURNING_LOGO_IN = 400
const RETURNING_HOLD = 200
const RETURNING_FADE_OUT = 400
const RETURNING_LOGO_DELAY = RETURNING_CIRCLE_IN
const RETURNING_FADE_DELAY =
  RETURNING_CIRCLE_IN + RETURNING_LOGO_IN + RETURNING_HOLD

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
    descriptionKey: 'intro.steps.coordination.description' as const,
    titleKey: 'intro.steps.coordination.title' as const
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
    descriptionKey: 'intro.steps.saveSpend.description' as const,
    titleKey: 'intro.steps.saveSpend.title' as const
  },
  {
    descriptionKey: 'intro.steps.saveFollowup.description' as const,
    titleKey: 'intro.steps.saveFollowup.title' as const
  },
  {
    descriptionKey: 'intro.steps.thanks.description' as const,
    titleKey: 'intro.steps.thanks.title' as const
  }
]

type IntroStepCopyKeys =
  | (typeof STEP_CONFIGS)[number]
  | {
      descriptionKey: 'intro.steps.spendFollowup.description'
      titleKey: 'intro.steps.spendFollowup.title'
    }

function getIntroStepCopyKeys(
  step: number,
  saveSpendChoice: 'save' | 'spend' | null
): IntroStepCopyKeys {
  if (step === 9) {
    const branch = saveSpendChoice ?? 'save'
    if (branch === 'spend') {
      return {
        descriptionKey: 'intro.steps.spendFollowup.description' as const,
        titleKey: 'intro.steps.spendFollowup.title' as const
      }
    }
    return {
      descriptionKey: 'intro.steps.saveFollowup.description' as const,
      titleKey: 'intro.steps.saveFollowup.title' as const
    }
  }
  return STEP_CONFIGS[step]
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
  const [saveSpendChoice, setSaveSpendChoice] = useState<
    'save' | 'spend' | null
  >(null)
  const stepSwitchingRef = useRef(false)

  const containerOpacity = useSharedValue(1)
  const circleScale = useSharedValue(0)
  const logoOpacity = useSharedValue(0)
  const stepTransition = useSharedValue(0)
  const thanksFinaleProgress = useSharedValue(0)
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
        withTiming(0, {
          duration: TRANSITION_MS,
          easing: Easing.out(Easing.quad)
        })
      )
      textSlideX.set(
        withDelay(
          TEXT_SLIDE_DELAY,
          withTiming(0, {
            duration: TRANSITION_MS,
            easing: Easing.out(Easing.quad)
          })
        )
      )
      descSlideX.set(
        withDelay(
          DESC_SLIDE_DELAY,
          withTiming(0, {
            duration: TRANSITION_MS,
            easing: Easing.out(Easing.quad)
          })
        )
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
        withDelay(
          RETURNING_LOGO_DELAY,
          withTiming(1, { duration: RETURNING_LOGO_IN })
        )
      )
      containerOpacity.set(
        withDelay(
          RETURNING_FADE_DELAY,
          withTiming(0, { duration: RETURNING_FADE_OUT }, (finished) => {
            if (finished) {
              runOnJS(onComplete)()
            }
          })
        )
      )
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fires after React commits the new step — guarantees the old step is
  // already unmounted before the fade-in starts, preventing ghost flashes.
  useEffect(() => {
    if (!stepSwitchingRef.current) {
      return
    }
    stepSwitchingRef.current = false
    stepOffsetX.set(
      withTiming(0, {
        duration: TRANSITION_MS,
        easing: Easing.out(Easing.quad)
      })
    )
    textSlideX.set(
      withDelay(
        TEXT_SLIDE_DELAY,
        withTiming(0, {
          duration: TRANSITION_MS,
          easing: Easing.out(Easing.quad)
        })
      )
    )
    descSlideX.set(
      withDelay(
        DESC_SLIDE_DELAY,
        withTiming(0, {
          duration: TRANSITION_MS,
          easing: Easing.out(Easing.quad)
        })
      )
    )
    stepTransition.set(withTiming(1, { duration: TRANSITION_MS }))
  }, [currentStep]) // eslint-disable-line react-hooks/exhaustive-deps

  function startLogoFinale() {
    if (firstTime) {
      // Logo is already visible in ThanksStep — fade out UI, scale logo up,
      // then exit
      stepTransition.set(withTiming(0, { duration: THANKS_FINALE_UI_FADE_MS }))
      thanksFinaleProgress.set(
        withDelay(
          150,
          withTiming(1, { duration: THANKS_FINALE_DURATION_MS }, () => {
            containerOpacity.set(
              withDelay(
                THANKS_FINALE_HOLD_MS,
                withTiming(
                  0,
                  { duration: THANKS_FINALE_OUT_MS },
                  (finished) => {
                    if (finished) {
                      runOnJS(onComplete)()
                    }
                  }
                )
              )
            )
          })
        )
      )
      return
    }

    setIsLogoFinale(true)
    circleScale.set(
      withTiming(1, {
        duration: CIRCLE_IN_MS,
        easing: Easing.out(Easing.back(1.4))
      })
    )
    logoOpacity.set(
      withDelay(
        CIRCLE_IN_MS - LOGO_OVERLAP_MS,
        withTiming(1, { duration: LOGO_IN_MS })
      )
    )
    containerOpacity.set(
      withDelay(
        CIRCLE_IN_MS + LOGO_IN_MS + LOGO_HOLD_MS,
        withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
          if (finished) {
            runOnJS(onComplete)()
          }
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
    if (step === 9) {
      setSaveSpendChoice(null)
    }
    setCurrentStep(prev)
  }

  function handleNext() {
    const step = currentStep
    textSlideX.set(withTiming(SLIDE_OUT_OFFSET, { duration: TRANSITION_MS }))
    descSlideX.set(withTiming(SLIDE_OUT_OFFSET, { duration: TRANSITION_MS }))
    stepOffsetX.set(withTiming(SLIDE_OUT_OFFSET, { duration: TRANSITION_MS }))
    stepTransition.set(
      withTiming(0, { duration: TRANSITION_MS }, (finished) => {
        if (finished) {
          runOnJS(advanceFromStep)(step)
        }
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
        if (finished) {
          runOnJS(goBackFromStep)(step)
        }
      })
    )
  }

  function handleSkip() {
    containerOpacity.value = 0
    onComplete()
  }

  function handleSaveSpendPick(choice: 'save' | 'spend') {
    setSaveSpendChoice(choice)
    handleNext()
  }

  function handleSaveSpendFollowUpPick() {
    handleNext()
  }

  const isLastStep = currentStep === STEP_COUNT - 1
  const stepCopyKeys = getIntroStepCopyKeys(currentStep, saveSpendChoice)
  const safeBottom = Math.max(bottomInset, MIN_BOTTOM_PADDING)

  return (
    <Animated.View style={[styles.overlay, containerStyle]}>
      {firstTime && !isLogoFinale && (
        <>
          {currentStep === 3 && (
            <SSIntroAnimationLayersStep stepTransition={stepTransition} />
          )}
          <Animated.View
            style={[styles.fullScreen, stepContentStyle]}
            pointerEvents="box-none"
          >
            {currentStep === 0 && (
              <SSIntroAnimationHexStreamStep screenHeight={screenHeight} />
            )}
            {currentStep === 1 && (
              <SSIntroAnimationBubbleStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
              />
            )}
            {currentStep === 2 && (
              <SSIntroAnimationSankeyStep screenHeight={screenHeight} />
            )}
            {currentStep === 4 && (
              <SSIntroAnimationPrivacyStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
              />
            )}
            {currentStep === 5 && (
              <SSIntroAnimationCoordinationStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
              />
            )}
            {currentStep === 6 && (
              <SSIntroAnimationExplorerStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
              />
            )}
            {currentStep === 7 && (
              <SSIntroAnimationRoadmapStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
              />
            )}
            {currentStep === 8 && (
              <SSIntroAnimationSaveSpendStep onPick={handleSaveSpendPick} />
            )}
            {currentStep === 9 && saveSpendChoice !== null && (
              <SSIntroAnimationSaveSpendFollowUpStep
                branch={saveSpendChoice}
                onPick={handleSaveSpendFollowUpPick}
              />
            )}
            {currentStep === 10 && (
              <SSIntroAnimationThanksStep
                screenWidth={screenWidth}
                screenHeight={screenHeight}
                finaleProgress={thanksFinaleProgress}
              />
            )}

            <LinearGradient
              colors={['transparent', Colors.gray[950]]}
              style={styles.bottomGradient}
              pointerEvents="none"
            />
          </Animated.View>

          <View style={[styles.satsignerLabel, { bottom: safeBottom + 270 }]}>
            <Text style={styles.welcomeText}>SATSIGNER</Text>
          </View>

          <View style={[styles.titleBlock, { bottom: safeBottom + 172 }]}>
            <Animated.View style={stepTextStyle}>
              <SSText size="xl" style={styles.stepTitle}>
                {t(stepCopyKeys.titleKey)}
              </SSText>
            </Animated.View>
            <Animated.View style={descTextStyle}>
              <SSText color="muted" size="sm" style={styles.stepDescription}>
                {t(stepCopyKeys.descriptionKey)}
              </SSText>
            </Animated.View>
          </View>

          <View
            style={[styles.persistentButtons, { paddingBottom: safeBottom }]}
          >
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
            ) : currentStep === 8 || currentStep === 9 ? (
              <View style={styles.saveSpendBottomSpacer} />
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

      {!firstTime && (
        <Animated.View style={[styles.logoWrapper, circleStyle]}>
          <View style={styles.logoCircle}>
            <Animated.View style={logoStyle}>
              <Text style={styles.logoText}>{'SAT\nSIGNER'}</Text>
            </Animated.View>
          </View>
        </Animated.View>
      )}
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
  logoWrapper: {
    ...StyleSheet.absoluteFillObject,
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
  persistentButtons: {
    bottom: 0,
    gap: 12,
    left: 0,
    paddingHorizontal: 24,
    position: 'absolute',
    right: 0
  },
  satsignerLabel: {
    left: 0,
    position: 'absolute',
    right: 0
  },
  saveSpendBottomSpacer: {
    minHeight: 52
  },
  sideButton: {
    flex: 1
  },
  stepDescription: {
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'center'
  },
  stepTitle: {
    fontFamily: Typography.sfProTextLight,
    textAlign: 'center'
  },
  titleBlock: {
    gap: 8,
    left: 0,
    paddingHorizontal: 24,
    position: 'absolute',
    right: 0
  },
  welcomeText: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: Typography.sfProTextLight,
    fontSize: 11,
    letterSpacing: 3,
    textAlign: 'center'
  }
})

export default SSIntroAnimation
