import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'

import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import {
  buildPackedBubbleLayout,
  type PackedBubbleDatum
} from '@/utils/packedBubbleLayout'

type SSPackedBubbleChartProps = {
  data: PackedBubbleDatum[]
  emptyText: string
  height: number
  onPress?: (id: string) => void
  width: number
}

const { 700: BUBBLE_FILL } = Colors.gray
const { 600: BUBBLE_STROKE } = Colors.gray
const { 850: LOCKED_BUBBLE_FILL } = Colors.gray
const { 700: LOCKED_BUBBLE_STROKE } = Colors.gray
const { 400: LOCKED_BUBBLE_TEXT } = Colors.gray
const SELECTED_BUBBLE_STROKE = Colors.white
const SELECTED_STROKE_WIDTH = 1.5
const DEFAULT_STROKE_WIDTH = 0.5

function bubbleFill(datum: PackedBubbleDatum) {
  return datum.locked ? LOCKED_BUBBLE_FILL : BUBBLE_FILL
}

function bubbleStroke(datum: PackedBubbleDatum) {
  if (datum.selected) {
    return SELECTED_BUBBLE_STROKE
  }
  return datum.locked ? LOCKED_BUBBLE_STROKE : BUBBLE_STROKE
}

function SSPackedBubbleChart({
  data,
  emptyText,
  height,
  onPress,
  width
}: SSPackedBubbleChartProps) {
  if (data.length === 0) {
    return (
      <SSVStack itemsCenter style={styles.emptyState}>
        <SSText color="muted">{emptyText}</SSText>
      </SSVStack>
    )
  }

  const { chartSize, leaves } = buildPackedBubbleLayout(data, width, height)

  return (
    <View style={[styles.root, { height: chartSize, width: chartSize }]}>
      <Svg height={chartSize} width={chartSize}>
        {leaves.map((leaf) => (
          <Circle
            key={leaf.datum.id}
            cx={leaf.cx}
            cy={leaf.cy}
            fill={bubbleFill(leaf.datum)}
            r={leaf.r}
            stroke={bubbleStroke(leaf.datum)}
            strokeWidth={
              leaf.datum.selected ? SELECTED_STROKE_WIDTH : DEFAULT_STROKE_WIDTH
            }
          />
        ))}
        {leaves.map((leaf) => (
          <SvgText
            key={`text-${leaf.datum.id}`}
            fill={leaf.datum.locked ? LOCKED_BUBBLE_TEXT : Colors.white}
            fontSize={leaf.fontSize}
            textAnchor="middle"
            x={leaf.cx}
            y={leaf.cy + leaf.fontSize / 3}
          >
            {leaf.datum.label}
          </SvgText>
        ))}
      </Svg>
      {onPress &&
        leaves.map((leaf) => (
          <Pressable
            key={`hit-${leaf.datum.id}`}
            onPress={() => onPress(leaf.datum.id)}
            style={[
              styles.hit,
              {
                height: leaf.r * 2,
                left: leaf.cx - leaf.r,
                top: leaf.cy - leaf.r,
                width: leaf.r * 2
              }
            ]}
          />
        ))}
    </View>
  )
}

const styles = StyleSheet.create({
  emptyState: {
    paddingVertical: 40
  },
  hit: {
    borderRadius: 9999,
    position: 'absolute'
  },
  root: {
    alignSelf: 'center',
    position: 'relative'
  }
})

export default SSPackedBubbleChart
