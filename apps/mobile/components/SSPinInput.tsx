import { LinearGradient } from 'expo-linear-gradient'
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useState
} from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { PIN_SIZE } from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors, Sizes } from '@/styles'

import SSKeyboard from './SSKeyboard'
import SSText from './SSText'

const PIN_CELL_BORDER = Math.max(StyleSheet.hairlineWidth, 1)
const PIN_OUTER_RADIUS = Sizes.pinInput.borderRadius + PIN_CELL_BORDER
/** Keeps keyboard position stable when tries-left / warning copy appears (2 lines). */
const PIN_FEEDBACK_SLOT_MIN_HEIGHT = 64
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

type SSPinInputProps = {
  autoFocus?: boolean
  feedback?: ReactNode
  feedBackColor?: string
  feedbackBold?: boolean
  feedbackText?: string
  onFillEnded?: (pin: string) => void
  pin: string[]
  setPin: Dispatch<SetStateAction<string[]>>
  withClear?: boolean
}

function SSPinInput({
  pin,
  setPin,
  onFillEnded,
  feedback,
  feedbackText,
  feedBackColor = Colors.gray[300],
  feedbackBold = false,
  withClear = true
}: SSPinInputProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (pin.join('') === '') {
      setCurrentIndex(0)
    }
  }, [pin])

  function handleDelete() {
    const newPin = [...pin]
    const previousIndex = currentIndex - 1
    if (previousIndex > -1) {
      newPin[previousIndex] = ''
    }
    setCurrentIndex((currentIndex) => currentIndex - 1)
    setPin(newPin)
  }

  function handleClear() {
    setCurrentIndex(0)
    setPin(Array.from({ length: PIN_SIZE }).map((_) => ''))
  }

  function handlePress(digit: string) {
    const newPin = [...pin]
    const lastIndex = PIN_SIZE - 1
    if (currentIndex > lastIndex) {
      return
    }

    newPin[currentIndex] = digit
    setPin(newPin)

    if (currentIndex === lastIndex && onFillEnded) {
      onFillEnded(newPin.join(''))
    }

    setCurrentIndex((currentValue) => currentValue + 1)
  }

  return (
    <SSVStack itemsCenter gap="none" justifyBetween>
      <SSVStack gap="none" itemsCenter widthFull>
        <SSHStack gap="sm">
          {Array.from({ length: PIN_SIZE }).map((_, index) => {
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
                  height: Sizes.pinInput.height,
                  overflow: 'hidden',
                  padding: PIN_CELL_BORDER,
                  width: Sizes.pinInput.width
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
                    value={isFilled ? '•' : ''}
                    readOnly
                  />
                  <PinDigitGlassOverlay
                    isActive={isActive}
                    isFilled={isFilled}
                  />
                </View>
              </LinearGradient>
            )
          })}
        </SSHStack>
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
                      { color: feedBackColor, lineHeight: 16 }
                    ]}
                  >
                    {line}
                  </SSText>
                ))
              : null}
          </View>
        ) : null}
      </SSVStack>
      <SSVStack gap="md" itemsCenter widthFull>
        {feedback}
        <SSKeyboard
          onPress={handlePress}
          onClear={handleClear}
          onDelete={handleDelete}
          withClear={withClear}
        />
      </SSVStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
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
  pinGlassBottom: {
    bottom: 0,
    left: 0,
    right: 0
  },
  pinGlassEdge: {
    position: 'absolute'
  },
  pinGlassHost: {
    ...StyleSheet.absoluteFillObject,
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
  }
})

export default SSPinInput
