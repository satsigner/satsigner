import { Canvas, Circle, Text, useFont } from '@shopify/react-native-skia'
import { useState } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'

import SSText from '@/components/SSText'
import { Colors } from '@/styles'

const CANVAS_HEIGHT = 200
const DOT_MIN_RADIUS = 4
const DOT_MAX_RADIUS = 28
const COLS = 5
const ROWS = 3

type DistributionEntry = {
  country: string
  count: number
}

type SSNetworkDotsProps = {
  distribution: DistributionEntry[]
}

export default function SSNetworkDots({ distribution }: SSNetworkDotsProps) {
  const { width } = useWindowDimensions()
  const font = useFont(require('@/assets/fonts/SF-Pro-Text-Regular.otf'), 10)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  if (distribution.length === 0) {
    return null
  }

  const displayEntries = distribution.slice(0, COLS * ROWS)
  const maxCount = Math.max(...displayEntries.map((e) => e.count))

  const cellWidth = width / COLS
  const cellHeight = CANVAS_HEIGHT / ROWS

  const dots = displayEntries.map((entry, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const cx = cellWidth * col + cellWidth / 2
    const cy = cellHeight * row + cellHeight / 2
    const ratio = entry.count / maxCount
    const radius = DOT_MIN_RADIUS + ratio * (DOT_MAX_RADIUS - DOT_MIN_RADIUS)
    return { count: entry.count, country: entry.country, cx, cy, i, radius }
  })

  const selectedEntry =
    selectedIndex !== null ? displayEntries[selectedIndex] : null

  return (
    <View>
      <Canvas style={{ height: CANVAS_HEIGHT, width }}>
        {dots.map((dot) => (
          <Circle
            key={dot.country}
            cx={dot.cx}
            cy={dot.cy}
            r={dot.radius}
            color={selectedIndex === dot.i ? Colors.white : Colors.mainGreen}
            opacity={selectedIndex === dot.i ? 1 : 0.7}
          />
        ))}
        {font &&
          dots.map((dot) => {
            const label = dot.country.slice(0, 2)
            const labelWidth = font.getTextWidth(label)
            return (
              <Text
                key={`label-${dot.country}`}
                x={dot.cx - labelWidth / 2}
                y={dot.cy + 4}
                text={label}
                font={font}
                color={Colors.black}
              />
            )
          })}
      </Canvas>

      {/* Touch overlay */}
      <View style={[StyleSheet.absoluteFillObject, { height: CANVAS_HEIGHT }]}>
        {dots.map((dot) => (
          <TouchableOpacity
            key={dot.country}
            style={[
              styles.dotTouchTarget,
              {
                height: dot.radius * 2 + 16,
                left: dot.cx - dot.radius - 8,
                top: dot.cy - dot.radius - 8,
                width: dot.radius * 2 + 16
              }
            ]}
            onPress={() =>
              setSelectedIndex(selectedIndex === dot.i ? null : dot.i)
            }
          />
        ))}
      </View>

      {selectedEntry && (
        <View style={styles.tooltip}>
          <SSText size="sm" style={styles.tooltipCountry}>
            {selectedEntry.country}
          </SSText>
          <SSText size="xs" style={styles.tooltipCount}>
            {selectedEntry.count.toLocaleString()} nodes
          </SSText>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  dotTouchTarget: {
    borderRadius: 999,
    position: 'absolute'
  },
  tooltip: {
    alignItems: 'center',
    backgroundColor: Colors.gray['900'],
    borderColor: Colors.gray['700'],
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 10
  },
  tooltipCount: { color: Colors.mainGreen },
  tooltipCountry: { color: Colors.white }
})
