import { LinearGradient } from 'expo-linear-gradient'
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useRef,
  useState
} from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors, Layout, Sizes } from '@/styles'
import {
  deletePinDigit,
  emptyPin,
  fillPinDigit,
  getPinCursorIndex,
  isPinFilled
} from '@/utils/pin'

import SSKeyboard from './SSKeyboard'
import SSText from './SSText'

export type SSPinInputProps = {
  belowInput?: ReactNode
  feedback?: ReactNode
  feedbackColor?: string
  feedbackBold?: boolean
  feedbackText?: string
  onFillEnded?: (pin: string) => void
  pin: string[]
  setPin: Dispatch<SetStateAction<string[]>>
  withClear?: boolean
  withDelete?: boolean
}

function SSPinInput({
  pin,
  setPin,
  onFillEnded,
  belowInput,
  feedback,
  feedbackText,
  feedbackColor = Colors.gray[300],
  feedbackBold = false,
  withClear = true,
  withDelete = true
}: SSPinInputProps) {
  const currentIndex = getPinCursorIndex(pin)

  // Cells shrink to fit the content width (which matches the keyboard below) so
  // longer PINs (up to 8) never clip or grow wider than the keyboard; they never
  // grow past the max square size.
  const cellGap = Layout.hStack.gap.xs
  const [rowWidth, setRowWidth] = useState(0)
  const cellSize =
    rowWidth > 0
      ? Math.min(
          PIN_CELL_MAX_SIZE,
          Math.floor((rowWidth - cellGap * (pin.length - 1)) / pin.length)
        )
      : PIN_CELL_MAX_SIZE
  // Filled dot scales with the cell and is centered geometrically (not via
  // font metrics), so it stays visible and centered at every PIN length.
  const dotSize = Math.max(5, Math.round(cellSize * 0.18))

  const fillEndedFiredRef = useRef(false)

  useEffect(() => {
    if (!isPinFilled(pin)) {
      fillEndedFiredRef.current = false
      return
    }
    if (fillEndedFiredRef.current) {
      return
    }
    fillEndedFiredRef.current = true
    if (onFillEnded) {
      onFillEnded(pin.join(''))
    }
  }, [pin, onFillEnded])

  function handleDelete() {
    setPin(deletePinDigit)
  }

  function handleClear() {
    setPin(emptyPin(pin.length))
  }

  function handlePress(digit: string) {
    setPin((prev) => fillPinDigit(prev, digit))
  }

  return (
    <SSVStack itemsCenter gap="none" justifyBetween>
      <SSVStack gap="none" itemsCenter widthFull>
        <View
          style={styles.pinRow}
          onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        >
          <SSHStack gap="xs">
            {Array.from({ length: pin.length }).map((_, index) => {
              const isActive = index === currentIndex
              const isFilled = pin[index] !== ''
              const rim = getPinFieldLight(index, isActive, isFilled)

              return (
                <LinearGradient
                  key={index}
                  colors={rim.colors}
                  end={rim.end}
                  locations={rim.locations}
                  start={rim.start}
                  style={{
                    borderRadius: PIN_OUTER_RADIUS,
                    height: cellSize,
                    overflow: 'hidden',
                    padding: PIN_CELL_BORDER,
                    width: cellSize
                  }}
                >
                  <View
                    style={{
                      borderRadius: Sizes.pinInput.borderRadius,
                      flex: 1,
                      overflow: 'hidden'
                    }}
                  >
                    <TextInput
                      style={[
                        styles.pinInputBase,
                        isFilled && !isActive && styles.pinInputFilled,
                        isActive && !isFilled && styles.pinInputActiveEmpty,
                        isActive && isFilled && styles.pinInputActiveFilled
                      ]}
                      value=""
                      readOnly
                    />
                    {isFilled ? (
                      <View pointerEvents="none" style={styles.pinDotHost}>
                        <View
                          style={{
                            backgroundColor: Colors.white,
                            borderRadius: dotSize / 2,
                            height: dotSize,
                            width: dotSize
                          }}
                        />
                      </View>
                    ) : null}
                    <PinDigitGlassOverlay
                      isActive={isActive}
                      isFilled={isFilled}
                    />
                    {isActive && <PinCellGlow />}
                  </View>
                </LinearGradient>
              )
            })}
          </SSHStack>
        </View>
        {feedbackText !== undefined ? (
          <View style={styles.feedbackSlot}>
            {feedbackText
              ? feedbackText.split('\n').map((line, i) => (
                  <SSText
                    key={i}
                    uppercase
                    center
                    size="sm"
                    weight={feedbackBold && i === 0 ? 'bold' : 'regular'}
                    style={[
                      styles.feedbackText,
                      { color: feedbackColor, lineHeight: 16 }
                    ]}
                  >
                    {line}
                  </SSText>
                ))
              : null}
          </View>
        ) : null}
        {feedback ? <View style={styles.feedbackSlot}>{feedback}</View> : null}
        {belowInput ? (
          <View style={styles.belowInputSlot}>{belowInput}</View>
        ) : null}
      </SSVStack>
      <SSVStack gap="md" itemsCenter widthFull>
        <SSKeyboard
          onPress={handlePress}
          onClear={handleClear}
          onDelete={handleDelete}
          withClear={withClear}
          withDelete={withDelete}
        />
      </SSVStack>
    </SSVStack>
  )
}

const PIN_CELL_BORDER = Math.max(StyleSheet.hairlineWidth, 1)
const PIN_OUTER_RADIUS = Sizes.pinInput.borderRadius + PIN_CELL_BORDER
/** Max square size; smaller than the raw cell so short PINs aren't oversized. */
const PIN_CELL_MAX_SIZE = 54
const PIN_FEEDBACK_SLOT_MIN_HEIGHT = 64 /** Keeps keyboard position stable when tries-left / warning copy appears (2 lines). */
const PIN_LIGHT_SPREAD = 0.28
const PIN_LIGHT_X_HALF = 0.072

function PinDigitGlassOverlay({
  isActive,
  isFilled
}: {
  isActive: boolean
  isFilled: boolean
}) {
  const m = isActive && isFilled ? 1.52 : isActive ? 1.42 : isFilled ? 1.18 : 1
  const edge = Math.max(StyleSheet.hairlineWidth, 1)
  const w = (a: number) =>
    `rgba(255,255,255,${Math.min(0.28, a * m).toFixed(3)})`
  const k = (a: number) => `rgba(0,0,0,${Math.min(0.35, a * m).toFixed(3)})`

  return (
    <View pointerEvents="none" style={styles.pinGlassHost}>
      <LinearGradient
        colors={[k(0.1), k(0.05), k(0)]}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        style={[styles.pinGlassEdge, styles.pinGlassTop, { height: edge }]}
      />
      <LinearGradient
        colors={[w(0.05), w(0.2), w(0.09)]}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0 }}
        style={[styles.pinGlassEdge, styles.pinGlassBottom, { height: edge }]}
      />
      <LinearGradient
        colors={[k(0.08), w(0.05)]}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.pinGlassEdge, styles.pinGlassLeft, { width: edge }]}
      />
      <LinearGradient
        colors={[k(0.06), w(0.04)]}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.pinGlassEdge, styles.pinGlassRight, { width: edge }]}
      />
    </View>
  )
}

function PinCellGlow() {
  const opacity = useSharedValue(0)
  const started = useRef(false)

  if (!started.current) {
    started.current = true
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.07, { duration: 500 }),
        withTiming(0, { duration: 500 })
      ),
      -1
    )
  }

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pinCellGlow, animatedStyle]}
    />
  )
}

function getPinFieldLight(
  index: number,
  isActive: boolean,
  isFilled: boolean
): {
  colors: [string, string, string]
  end: { x: number; y: number }
  locations: [number, number, number]
  start: { x: number; y: number }
} {
  const s = PIN_LIGHT_SPREAD
  const cx = 0.5 + Math.sin(index * 0.72) * 0.024
  const xHalf =
    isActive && isFilled
      ? PIN_LIGHT_X_HALF + 0.03
      : isActive
        ? PIN_LIGHT_X_HALF + 0.024
        : isFilled
          ? PIN_LIGHT_X_HALF + 0.012
          : PIN_LIGHT_X_HALF
  // Top → bottom: subtle top rim, strongest glow on bottom (inset under overhead light).
  let topA: number
  let midA: number
  let bottomA: number
  if (isActive && isFilled) {
    topA = 0.12
    midA = 0.19
    bottomA = 0.4
  } else if (isActive) {
    topA = 0.1
    midA = 0.16
    bottomA = 0.36
  } else if (isFilled) {
    topA = 0.055
    midA = 0.09
    bottomA = 0.2
  } else {
    topA = 0.021
    midA = 0.034
    bottomA = 0.088
  }

  return {
    colors: [
      `rgba(255,255,255,${topA.toFixed(3)})`,
      `rgba(255,255,255,${midA.toFixed(3)})`,
      `rgba(255,255,255,${bottomA.toFixed(3)})`
    ],
    end: { x: cx + xHalf, y: 1 + s * 0.4 },
    locations: [0, 0.48, 1],
    start: { x: cx - xHalf, y: -s * 0.4 }
  }
}

const styles = StyleSheet.create({
  belowInputSlot: {
    alignItems: 'center',
    paddingTop: 24,
    width: '100%'
  },
  feedbackSlot: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    minHeight: PIN_FEEDBACK_SLOT_MIN_HEIGHT,
    paddingTop: 30,
    width: '100%'
  },
  feedbackText: {
    alignSelf: 'stretch',
    textAlign: 'center',
    width: '100%'
  },
  pinCellGlow: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.pinInput.borderRadius,
    inset: 0,
    position: 'absolute',
    zIndex: 2
  },
  pinDotHost: {
    alignItems: 'center',
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 1
  },
  pinGlassBottom: {
    bottom: 0,
    left: 0,
    right: 0
  },
  pinGlassEdge: {
    position: 'absolute'
  },
  pinGlassHost: {
    inset: 0,
    position: 'absolute',
    zIndex: 1
  },
  pinGlassLeft: {
    bottom: 0,
    left: 0,
    top: 0
  },
  pinGlassRight: {
    bottom: 0,
    right: 0,
    top: 0
  },
  pinGlassTop: {
    left: 0,
    right: 0,
    top: 0
  },
  pinInputActiveEmpty: {
    backgroundColor: Colors.gray[700]
  },
  pinInputActiveFilled: {
    backgroundColor: Colors.gray[500]
  },
  pinInputBase: {
    backgroundColor: Colors.gray[850],
    borderRadius: Sizes.pinInput.borderRadius,
    color: Colors.white,
    flex: 1,
    fontSize: Sizes.textInput.fontSize.default,
    height: '100%',
    textAlign: 'center',
    width: '100%'
  },
  pinInputFilled: {
    backgroundColor: Colors.gray[800]
  },
  pinRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: PIN_CELL_MAX_SIZE,
    width: '100%'
  }
})

export default SSPinInput
