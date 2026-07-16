import { useEffect, useRef } from 'react'
import { BackHandler, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkReceiveOverlayStore } from '@/store/arkReceiveOverlay'
import { usePriceStore } from '@/store/price'
import { Colors, Layout } from '@/styles'
import type { ArkReceiveOverlayEvent } from '@/types/models/Ark'
import { formatFiatPrice } from '@/utils/format'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)

const ICON_SIZE = 150
const CIRCLE_RADIUS = 54
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS
const CHECK_PATH = 'M38 63l14 14 32-32'
const CHECK_PATH_LENGTH = 66

const BACKDROP_FADE_IN_MS = 220
const BACKDROP_FADE_OUT_MS = 180
const CIRCLE_DRAW_MS = 650
const CHECK_DELAY_MS = 420
const CHECK_DRAW_MS = 380
const PULSE_DELAY_MS = 250
const PULSE_STAGGER_MS = 220
const PULSE_DURATION_MS = 1000
const PULSE_MAX_SCALE = 1.9
const PULSE_START_OPACITY = 0.3
const AMOUNT_DELAY_MS = 350
const DETAILS_DELAY_MS = 550
const BUTTON_DELAY_MS = 700
const VERTICAL_PADDING = Layout.mainContainer.paddingBottom

function ReceivePulseRing({ delay }: { delay: number }) {
  const progress = useSharedValue(0)
  const started = useRef(false)

  if (!started.current) {
    started.current = true
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: PULSE_DURATION_MS,
        easing: Easing.out(Easing.quad)
      })
    )
  }

  const ringStyle = useAnimatedStyle(() => ({
    opacity: PULSE_START_OPACITY * (1 - progress.value),
    transform: [{ scale: 1 + (PULSE_MAX_SCALE - 1) * progress.value }]
  }))

  return <Animated.View style={[styles.pulseRing, ringStyle]} />
}

function ReceiveCheckIcon() {
  const circleOffset = useSharedValue(CIRCLE_CIRCUMFERENCE)
  const checkOffset = useSharedValue(CHECK_PATH_LENGTH)
  const started = useRef(false)

  if (!started.current) {
    started.current = true
    circleOffset.value = withTiming(0, {
      duration: CIRCLE_DRAW_MS,
      easing: Easing.out(Easing.cubic)
    })
    checkOffset.value = withDelay(
      CHECK_DELAY_MS,
      withTiming(0, {
        duration: CHECK_DRAW_MS,
        easing: Easing.out(Easing.quad)
      })
    )
  }

  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: circleOffset.value
  }))

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: checkOffset.value
  }))

  return (
    <View style={styles.iconContainer}>
      <ReceivePulseRing delay={PULSE_DELAY_MS} />
      <ReceivePulseRing delay={PULSE_DELAY_MS + PULSE_STAGGER_MS} />
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 120 120">
        <AnimatedCircle
          cx="60"
          cy="60"
          r={CIRCLE_RADIUS}
          fill="none"
          stroke={Colors.mainGreen}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={CIRCLE_CIRCUMFERENCE}
          transform="rotate(-90 60 60)"
          animatedProps={circleProps}
        />
        <AnimatedPath
          d={CHECK_PATH}
          fill="none"
          stroke={Colors.mainGreen}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_PATH_LENGTH}
          animatedProps={checkProps}
        />
      </Svg>
    </View>
  )
}

function ReceiveOverlayContent({
  event,
  pendingCount
}: {
  event: ArkReceiveOverlayEvent
  pendingCount: number
}) {
  const dismissReceive = useArkReceiveOverlayStore(
    (state) => state.dismissReceive
  )
  const [fiatCurrency, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.btcPrice])
  )
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        dismissReceive()
        return true
      }
    )
    return () => subscription.remove()
  }, [dismissReceive])

  const fiatDisplay =
    btcPrice > 0
      ? `${formatFiatPrice(event.amountSats, btcPrice)} ${fiatCurrency}`
      : ''

  return (
    <Animated.View
      style={[
        styles.backdrop,
        {
          paddingBottom: insets.bottom + VERTICAL_PADDING,
          paddingTop: insets.top + VERTICAL_PADDING
        }
      ]}
      entering={FadeIn.duration(BACKDROP_FADE_IN_MS)}
      exiting={FadeOut.duration(BACKDROP_FADE_OUT_MS)}
    >
      <SSVStack justifyBetween itemsCenter style={styles.content}>
        <View />
        <SSVStack gap="lg" itemsCenter>
          <ReceiveCheckIcon />
          <Animated.View
            entering={FadeInDown.delay(AMOUNT_DELAY_MS).duration(450)}
          >
            <SSVStack gap="xs" itemsCenter>
              <SSText size="sm" color="muted" uppercase>
                {t('ark.notifications.receivedTitle')}
              </SSText>
              <SSVStack gap="none" itemsCenter>
                <SSStyledSatText
                  amount={event.amountSats}
                  type="receive"
                  noColor={false}
                  textSize="7xl"
                  weight="light"
                />
                <SSText size="lg" color="muted">
                  {t('bitcoin.sats')}
                </SSText>
              </SSVStack>
            </SSVStack>
          </Animated.View>
          <Animated.View
            entering={FadeIn.delay(DETAILS_DELAY_MS).duration(400)}
          >
            <SSVStack gap="xxs" itemsCenter>
              {fiatDisplay !== '' && (
                <SSText size="md" color="muted">
                  {fiatDisplay}
                </SSText>
              )}
              <SSText size="md">
                {t('ark.notifications.receivedTo', {
                  wallet: event.accountName
                })}
              </SSText>
              {pendingCount > 0 && (
                <SSText size="sm" color="muted">
                  {t('ark.notifications.morePending', { count: pendingCount })}
                </SSText>
              )}
            </SSVStack>
          </Animated.View>
        </SSVStack>
        <Animated.View
          style={styles.buttonContainer}
          entering={FadeIn.delay(BUTTON_DELAY_MS).duration(300)}
        >
          <SSButton
            label={t('common.dismiss')}
            variant="outline"
            onPress={dismissReceive}
          />
        </Animated.View>
      </SSVStack>
    </Animated.View>
  )
}

export default function SSArkReceiveOverlay() {
  const [event, pendingCount] = useArkReceiveOverlayStore(
    useShallow((state) => [state.queue[0], state.queue.length - 1])
  )

  if (!event) {
    return null
  }

  return (
    <ReceiveOverlayContent
      key={`${event.accountId}:${event.movementId}`}
      event={event}
      pendingCount={pendingCount}
    />
  )
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    bottom: 0,
    elevation: 1000,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1000
  },
  buttonContainer: {
    width: '100%'
  },
  content: {
    flex: 1,
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    width: '100%'
  },
  iconContainer: {
    alignItems: 'center',
    height: ICON_SIZE,
    justifyContent: 'center',
    width: ICON_SIZE
  },
  pulseRing: {
    borderColor: Colors.mainGreen,
    borderRadius: ICON_SIZE / 2,
    borderWidth: 1,
    height: ICON_SIZE,
    position: 'absolute',
    width: ICON_SIZE
  }
})
