import { hierarchy, pack } from 'd3'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'

import SSText from '@/components/SSText'
import { PRIVACY_MASK } from '@/constants/privacy'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { ArkVtxo } from '@/types/models/Ark'
import { formatNumber } from '@/utils/format'

const MIN_BUBBLE_RADIUS = 16
const CHART_PADDING = 8
const BUBBLE_PACK_PADDING = 4
const { 700: BUBBLE_FILL } = Colors.gray
const { 600: BUBBLE_STROKE } = Colors.gray
const { 850: LOCKED_BUBBLE_FILL } = Colors.gray
const { 700: LOCKED_BUBBLE_STROKE } = Colors.gray
const { 400: LOCKED_BUBBLE_TEXT } = Colors.gray
const SELECTED_BUBBLE_STROKE = Colors.white
const SELECTED_STROKE_WIDTH = 1.5
const DEFAULT_STROKE_WIDTH = 0.5

type VtxoNode = {
  amount: number
  children: VtxoNode[]
  id: string
  locked: boolean
}

type SSArkVtxosBubbleChartProps = {
  height: number
  onVtxoPress?: (vtxoId: string) => void
  privacyMode: boolean
  selectedIds: string[]
  vtxos: ArkVtxo[]
  width: number
}

function SSArkVtxosBubbleChart({
  height,
  onVtxoPress,
  privacyMode,
  selectedIds,
  vtxos,
  width
}: SSArkVtxosBubbleChartProps) {
  if (vtxos.length === 0) {
    return (
      <SSVStack itemsCenter style={styles.emptyState}>
        <SSText color="muted">{t('ark.vtxo.empty')}</SSText>
      </SSVStack>
    )
  }

  const root = hierarchy<VtxoNode>({
    amount: 0,
    children: vtxos.map((vtxo) => ({
      amount: vtxo.amountSats,
      children: [],
      id: vtxo.id,
      locked: !vtxo.spendable
    })),
    id: 'root',
    locked: false
  }).sum((d) => Math.max(d.amount, 1))

  // d3 HierarchyNode.sort() is not Array.sort — .toSorted() does not exist on it
  const compareFn = (
    a: { value?: number | null },
    b: { value?: number | null }
  ) => (b.value ?? 0) - (a.value ?? 0)
  root.sort(compareFn)

  const chartSize = Math.min(width, height)
  const packLayout = pack<VtxoNode>()
    .size([chartSize - CHART_PADDING * 2, chartSize - CHART_PADDING * 2])
    .padding(BUBBLE_PACK_PADDING)

  const packed = packLayout(root)
  const leaves = packed.leaves()

  const fmt = (n: number) =>
    privacyMode ? PRIVACY_MASK : formatNumber(Math.round(n))

  return (
    <View style={[styles.root, { height: chartSize, width: chartSize }]}>
      <Svg height={chartSize} width={chartSize}>
        {leaves.map((leaf) => {
          const r = Math.max(leaf.r, MIN_BUBBLE_RADIUS)
          const cx = leaf.x + CHART_PADDING
          const cy = leaf.y + CHART_PADDING
          const selected = selectedIds.includes(leaf.data.id)
          const fill = leaf.data.locked ? LOCKED_BUBBLE_FILL : BUBBLE_FILL
          const stroke = selected
            ? SELECTED_BUBBLE_STROKE
            : leaf.data.locked
              ? LOCKED_BUBBLE_STROKE
              : BUBBLE_STROKE

          return (
            <Circle
              key={leaf.data.id}
              cx={cx}
              cy={cy}
              fill={fill}
              r={r}
              stroke={stroke}
              strokeWidth={
                selected ? SELECTED_STROKE_WIDTH : DEFAULT_STROKE_WIDTH
              }
            />
          )
        })}
        {leaves.map((leaf) => {
          const r = Math.max(leaf.r, MIN_BUBBLE_RADIUS)
          const cx = leaf.x + CHART_PADDING
          const cy = leaf.y + CHART_PADDING
          const fontSize = Math.max(7, Math.min(11, r * 0.55))

          return (
            <SvgText
              key={`text-${leaf.data.id}`}
              fill={leaf.data.locked ? LOCKED_BUBBLE_TEXT : Colors.white}
              fontSize={fontSize}
              textAnchor="middle"
              x={cx}
              y={cy + fontSize / 3}
            >
              {fmt(leaf.data.amount)}
            </SvgText>
          )
        })}
      </Svg>
      {onVtxoPress &&
        leaves.map((leaf) => {
          const r = Math.max(leaf.r, MIN_BUBBLE_RADIUS)
          const cx = leaf.x + CHART_PADDING
          const cy = leaf.y + CHART_PADDING

          return (
            <Pressable
              key={`hit-${leaf.data.id}`}
              onPress={() => onVtxoPress(leaf.data.id)}
              style={[
                styles.hit,
                {
                  height: r * 2,
                  left: cx - r,
                  top: cy - r,
                  width: r * 2
                }
              ]}
            />
          )
        })}
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

export default SSArkVtxosBubbleChart
