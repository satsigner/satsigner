import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import {
  DimensionValue,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'

import SSHStack from '@/layouts/SSHStack'
import { Colors, Sizes } from '@/styles'
import { hStack, type HStackGap } from '@/styles/layout'
import { range, shuffle } from '@/utils/array'

import { SSIconDelete, SSIconTrash } from './icons'
import SSText from './SSText'

type SSKeyboardProps = {
  gap?: HStackGap
  items?: string[]
  nCols?: number
  onClear?: () => void
  onDelete?: () => void
  onPress?: (item: string) => void
  random?: boolean
  withClear?: boolean
  withDelete?: boolean
}

type SSKeyboardCellProps = {
  cellWidth: DimensionValue
  gap: HStackGap
  index: number
  item: string
  nCols: number
  onKeyPress: (item: string) => void
}

const KEY_CLEAR = 'CLEAR'
const KEY_DELETE = 'DEL'
const CONTROL_KEYS = new Set([KEY_CLEAR, KEY_DELETE])
const NUMERIC_PAD = [...range(10, 1).map((x) => x.toString()), '0']

const KEY_BORDER = Math.max(StyleSheet.hairlineWidth, 1)
const KEY_OUTER_RADIUS = Sizes.button.borderRadius + KEY_BORDER
const KEY_ASPECT_RATIO = 1.32 /** Width ÷ height; > 1 is wider than tall (less square than 1:1). */
const KEY_LIGHT_GRADIENT_SPREAD = 0.34 /** Extends gradient past the key bounds so the transition is stretched on the thin border ring. */
const KEY_LIGHT_CENTER_X_HALF = 0.075 /** Half-width of gradient in x (narrow = reads as overhead, not side-lit). */
const KEY_LIGHT_CENTER_WOBBLE = 0.028 /** Tiny horizontal wobble per key so they are not identical (stays near center). */
const KEY_LIGHT_INTENSITY_DROP_PER_ROW = 0.16 /** Each full row of keys dims the border slightly (distance from “source”). */
const KEY_LIGHT_MIN_INTENSITY = 0.5
const KEY_LIGHT_ALPHAS = [0.11, 0.03, 0.08] as const
const KEY_PRESS_IN_MS = 140
const KEY_PRESS_OUT_MS = 560
const KEY_PRESS_OVERLAY_OPACITY = 0.42 /** Peak opacity of the press highlight gradient wash. */

export default function SSKeyboard({
  onClear,
  onDelete,
  onPress,
  gap = 'xs',
  items = NUMERIC_PAD,
  nCols = 3,
  withClear = true,
  withDelete = true,
  random = false
}: SSKeyboardProps) {
  const pad = random ? shuffle(items) : [...items]
  const nRows = Math.ceil(pad.length / nCols)
  const cellWidth: DimensionValue = `${Math.floor(100 / nCols)}%`

  // 3-col pad pins CLEAR to bottom-left and DELETE to bottom-right, centering the last digit.
  if (nCols === 3) {
    const lastItem = pad.pop()
    pad.push(withClear ? KEY_CLEAR : '')
    pad.push(lastItem || '')
    pad.push(withDelete ? KEY_DELETE : '')
  } else {
    if (withClear) {
      pad.push(KEY_CLEAR)
    }
    if (withDelete) {
      pad.push(KEY_DELETE)
    }
  }

  function handleOnPress(item: string) {
    switch (item) {
      case KEY_DELETE:
        if (onDelete) {
          onDelete()
        }
        break
      case KEY_CLEAR:
        if (onClear) {
          onClear()
        }
        break
      default:
        if (onPress) {
          onPress(item)
        }
    }
  }

  return (
    <View>
      {range(nRows).map((i) => (
        <SSHStack key={i} style={styles.row}>
          {range(nCols).map((j) => {
            const idx = i * nCols + j
            if (idx >= pad.length) {
              return null
            }

            return (
              <SSKeyboardCell
                key={idx}
                cellWidth={cellWidth}
                gap={gap}
                index={idx}
                item={pad[idx]}
                nCols={nCols}
                onKeyPress={handleOnPress}
              />
            )
          })}
        </SSHStack>
      ))}
    </View>
  )
}

function SSKeyboardCell({
  cellWidth,
  gap,
  index,
  item,
  nCols,
  onKeyPress
}: SSKeyboardCellProps) {
  const press = useSharedValue(0)

  const pressOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(press.value, [0, 1], [0, KEY_PRESS_OVERLAY_OPACITY])
  }))

  function handlePressIn() {
    Haptics.impactAsync(
      isControlKey
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    )
    press.set(withTiming(1, { duration: KEY_PRESS_IN_MS }))
  }

  function handlePressOut() {
    press.set(withTiming(0, { duration: KEY_PRESS_OUT_MS }))
  }

  if (!item) {
    return <View style={{ padding: hStack['gap'][gap], width: cellWidth }} />
  }

  const borderLight = getKeyBorderLight(index, nCols)
  const isControlKey = CONTROL_KEYS.has(item)

  return (
    <View
      style={{
        padding: hStack['gap'][gap],
        width: cellWidth
      }}
    >
      <LinearGradient
        colors={borderLight.colors}
        end={borderLight.end}
        locations={borderLight.locations}
        start={borderLight.start}
        style={{
          aspectRatio: KEY_ASPECT_RATIO,
          borderRadius: KEY_OUTER_RADIUS,
          overflow: 'hidden',
          padding: KEY_BORDER,
          width: '100%'
        }}
      >
        <View
          style={{
            backgroundColor: Colors.gray[900],
            borderRadius: Sizes.button.borderRadius,
            flex: 1,
            overflow: 'hidden'
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.keyPressOverlay, pressOverlayStyle]}
          >
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.26)',
                'rgba(255,255,255,0.1)',
                'rgba(255,255,255,0.04)'
              ]}
              end={{ x: 0.92, y: 1 }}
              locations={[0, 0.45, 1]}
              start={{ x: 0.08, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
          <TouchableOpacity
            onPress={() => onKeyPress(item)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={{
              alignItems: 'center',
              alignSelf: 'stretch',
              backgroundColor: 'transparent',
              flex: 1,
              height: '100%',
              justifyContent: 'center'
            }}
          >
            {!isControlKey && (
              <SSText size="2xl" weight="light">
                {item}
              </SSText>
            )}
            {item === KEY_CLEAR && (
              <SSIconTrash
                width={Sizes.text.fontSize['xl']}
                height={Sizes.text.fontSize['xl']}
                strokeWidth={1}
              />
            )}
            {item === KEY_DELETE && (
              <SSIconDelete
                stroke="gray"
                width={Sizes.text.fontSize['2xl']}
                height={Sizes.text.fontSize['2xl']}
              />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  )
}

function getKeyBorderLight(
  index: number,
  nCols: number
): {
  colors: [string, string, string]
  end: { x: number; y: number }
  locations: [number, number, number]
  start: { x: number; y: number }
} {
  const s = KEY_LIGHT_GRADIENT_SPREAD
  const rowBlock = Math.floor(index / nCols)
  const intensity = Math.max(
    KEY_LIGHT_MIN_INTENSITY,
    1 - rowBlock * KEY_LIGHT_INTENSITY_DROP_PER_ROW
  )
  const colors = KEY_LIGHT_ALPHAS.map(
    (a) => `rgba(255,255,255,${Math.min(0.24, a * intensity).toFixed(3)})`
  ) as [string, string, string]

  const cx = 0.5 + Math.sin(index * 0.65) * KEY_LIGHT_CENTER_WOBBLE * 0.45

  return {
    colors,
    end: { x: cx + KEY_LIGHT_CENTER_X_HALF, y: 1 + s * 0.42 },
    locations: [0, 0.46, 1],
    start: { x: cx - KEY_LIGHT_CENTER_X_HALF, y: -s * 0.42 }
  }
}

const styles = StyleSheet.create({
  keyPressOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  row: {
    alignSelf: 'center',
    flexWrap: 'wrap',
    gap: 0,
    justifyContent: 'space-between'
  }
})
