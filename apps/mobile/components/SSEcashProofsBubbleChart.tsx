import { hierarchy, pack } from 'd3'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'

import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { EcashProof } from '@/types/models/Ecash'
import { formatNumber } from '@/utils/format'

const PRIVACY_MASK = '••••'
const MIN_BUBBLE_RADIUS = 16
const { 700: BUBBLE_FILL } = Colors.gray
const { 600: BUBBLE_STROKE } = Colors.gray
const CHART_PADDING = 8

type ProofNode = {
  amount: number
  children: ProofNode[]
  id: string
}

type SSEcashProofsBubbleChartProps = {
  height: number
  onProofPress?: (proofIndex: number) => void
  privacyMode: boolean
  proofs: EcashProof[]
  width: number
}

function SSEcashProofsBubbleChart({
  height,
  onProofPress,
  privacyMode,
  proofs,
  width
}: SSEcashProofsBubbleChartProps) {
  if (proofs.length === 0) {
    return (
      <SSVStack itemsCenter style={styles.emptyState}>
        <SSText color="muted">{t('ecash.accountDetail.noProofs')}</SSText>
      </SSVStack>
    )
  }

  const root = hierarchy<ProofNode>({
    amount: 0,
    children: proofs.map((proof, index) => ({
      amount: proof.amount,
      children: [],
      id: `${proof.id}-${index}`
    })),
    id: 'root'
  }).sum((d) => Math.max(d.amount, 1))

  // d3 HierarchyNode.sort() is not Array.sort — .toSorted() does not exist on it
  const compareFn = (
    a: { value?: number | null },
    b: { value?: number | null }
  ) => (b.value ?? 0) - (a.value ?? 0)
  root.sort(compareFn)

  const chartSize = Math.min(width, height)
  const packLayout = pack<ProofNode>()
    .size([chartSize - CHART_PADDING * 2, chartSize - CHART_PADDING * 2])
    .padding(4)

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

          return (
            <Circle
              key={leaf.data.id}
              cx={cx}
              cy={cy}
              fill={BUBBLE_FILL}
              r={r}
              stroke={BUBBLE_STROKE}
              strokeWidth={0.5}
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
              fill={Colors.white}
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
      {onProofPress &&
        leaves.map((leaf) => {
          const r = Math.max(leaf.r, MIN_BUBBLE_RADIUS)
          const cx = leaf.x + CHART_PADDING
          const cy = leaf.y + CHART_PADDING
          const proofIdx = Number(leaf.data.id.split('-').pop())

          return (
            <Pressable
              key={`hit-${leaf.data.id}`}
              onPress={() => onProofPress(proofIdx)}
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

export default SSEcashProofsBubbleChart
