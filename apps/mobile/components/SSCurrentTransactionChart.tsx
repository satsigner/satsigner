import { Canvas, Circle, Group } from '@shopify/react-native-skia'
import { sankey, type SankeyNodeMinimal } from 'd3-sankey'
import { useMemo } from 'react'
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { useShallow } from 'zustand/react/shallow'

import { useGestures } from '@/hooks/useGestures'
import { useLayout } from '@/hooks/useLayout'
import type { TxNode } from '@/hooks/useNodesAndLinks'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import type { Output } from '@/types/models/Output'
import type { Utxo } from '@/types/models/Utxo'
import {
  BLOCK_WIDTH,
  LINK_MAX_WIDTH,
  NODE_WIDTH,
  SAFE_LIMIT_OF_INPUTS_OUTPUTS
} from '@/types/ui/sankey'
import { formatAddress, formatNumber } from '@/utils/format'
import { estimateTransactionSize } from '@/utils/transaction'

import { withPerformanceWarning } from './SSPerformanceWarning'
import SSSankeyLinks from './SSSankeyLinks'
import SSSankeyNodes from './SSSankeyNodes'

interface Node extends SankeyNodeMinimal<object, object> {
  id: string
  depth?: number
  depthH: number
  address?: string
  type: string
  value?: number
  txId?: string
  ioData: TxNode['ioData']
  nextTx?: string
  localId?: string
}

type SSCurrentTransactionChartProps = {
  inputs: Map<string, Utxo>
  outputs: (Omit<Output, 'to'> & { to?: string })[]
  feeRate: number
  onPressOutput?: (localId?: string) => void
  currentOutputLocalId?: string
  ownAddresses?: Set<string> // NEW: prop for own addresses
}

function SSCurrentTransactionChart({
  inputs: inputMap,
  outputs: outputArray,
  feeRate: feeRateProp,
  onPressOutput,
  currentOutputLocalId,
  ownAddresses = new Set()
}: SSCurrentTransactionChartProps) {
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const inputArray = useMemo(() => Array.from(inputMap.values()), [inputMap])
  const totalInputValue = useMemo(
    () => inputArray.reduce((sum, input) => sum + input.value, 0),
    [inputArray]
  )
  const totalOutputValue = useMemo(
    () => outputArray.reduce((sum, output) => sum + output.amount, 0),
    [outputArray]
  )

  // First calculate without change output
  const baseSize = estimateTransactionSize(
    Array.from(inputMap.values()),
    outputArray.map((o) => ({ ...o, to: o.to || '' }))
  )

  const baseFee = Math.round(feeRateProp * baseSize.vsize)

  // Check if we'll have change
  const hasChange = totalInputValue > totalOutputValue + baseFee

  // Now calculate final size including change if needed
  const { size: txSize, vsize: txVsize } = estimateTransactionSize(
    Array.from(inputMap.values()),
    outputArray.map((o) => ({ ...o, to: o.to || '' })),
    hasChange
  )

  // Ensure transaction size values are valid
  const safeTxSize = Number.isNaN(txSize) ? 0 : txSize
  const safeTxVsize = Number.isNaN(txVsize) ? 0 : txVsize

  const minerFee = useMemo(() => {
    // Ensure feeRateProp and safeTxVsize are valid numbers
    if (
      Number.isNaN(feeRateProp) ||
      Number.isNaN(safeTxVsize) ||
      feeRateProp < 0 ||
      safeTxVsize < 0
    ) {
      return 0
    }
    return Math.round(feeRateProp * safeTxVsize)
  }, [feeRateProp, safeTxVsize])

  const { width: w, height: h, center, onCanvasLayout } = useLayout()

  const { animatedStyle, gestures, transform } = useGestures({
    center,
    height: h,
    isDoubleTapEnabled: true,
    maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
    maxScale: 20,
    minPanPointers: 1,
    minScale: 0.2,
    shouldResetOnInteractionEnd: false,
    width: w
  })

  const { width, height } = useWindowDimensions()
  const GRAPH_HEIGHT = height * 0.7
  const GRAPH_WIDTH = width
  const SANKEY_TOP_MARGIN = 200

  const sankeyGenerator = useMemo(() => {
    return sankey()
      .nodeWidth(NODE_WIDTH)
      .nodePadding(160)
      .extent([
        [0, SANKEY_TOP_MARGIN],
        [
          width,
          height *
            0.7 *
            // (Math.max(inputMap.size, outputArray.length + 1) * 0.237) // + 1 for the miner output
            (Math.max(inputMap.size, outputArray.length + 1) * 0.23)
        ]
      ])
      .nodeId((node: SankeyNodeMinimal<object, object>) => (node as Node).id)
  }, [inputMap, outputArray, width, height])

  sankeyGenerator.nodeAlign((node: SankeyNodeMinimal<object, object>) => {
    const { depthH } = node as Node
    return depthH ?? 0
  })

  const sankeyNodes = useMemo(() => {
    if (inputArray.length === 0 || outputArray.length === 0) {
      return []
    }

    const inputNodes: TxNode[] = inputArray.map((input, index) => ({
      depthH: 0,
      id: String(index + 1),
      ioData: {
        address: formatAddress(input.txid, 4),
        fiatCurrency,
        fiatValue: formatNumber(satsToFiat(input.value), 2),
        label: input.label ?? t('common.noLabel'),
        text: t('common.from'),
        value: input.value
      },
      type: 'text',
      value: input.value
    }))

    const blockNode: TxNode[] = [
      {
        depthH: 1,
        id: String(inputArray.length + 1),
        ioData: {
          txSize: safeTxSize,
          vSize: safeTxVsize,
          value: 0
        },
        type: 'block',
        value: 0
      }
    ]

    const outputNodes: TxNode[] = outputArray.map((output, index) => ({
      depthH: 2,
      id: String(index + 2 + inputArray.length),
      ioData: {
        address: output?.to ? formatAddress(output?.to, 6) : '',
        fiatCurrency,
        fiatValue: formatNumber(satsToFiat(output.amount), 2),
        isSelfSend: !!(output.to && ownAddresses.has(output.to)),
        isUnspent: true,
        label: output.label,
        text: t('transaction.build.unspent'),
        value: output.amount
      },
      localId: output.to ? output.localId : 'remainingBalance',
      type: 'text',
      value: output.amount
    }))

    if (minerFee !== undefined && minerFee > 0) {
      // Calculate total output value with addresses for fee analysis
      const totalOutputValueWithAddresses = outputArray
        .filter((output) => output.to && output.to.trim() !== '')
        .reduce((sum, output) => sum + output.amount, 0)

      const higherFee =
        totalOutputValueWithAddresses > 0
          ? minerFee >= totalOutputValueWithAddresses * 0.1
          : false

      const feePercentage =
        totalOutputValueWithAddresses > 0
          ? (minerFee / totalOutputValueWithAddresses) * 100
          : 0

      outputNodes.push({
        depthH: 2,
        id: String(inputArray.length + outputArray.length + 2),
        ioData: {
          feePercentage: Math.round(feePercentage * 100) / 100,
          feeRate:
            feeRateProp !== undefined ? Math.round(feeRateProp) : undefined,
          fiatCurrency,
          fiatValue: formatNumber(satsToFiat(minerFee), 2),
          higherFee,
          text: t('transaction.build.minerFee'),
          value: minerFee // round to 2 decimals
        },
        localId: 'current-minerFee',
        type: 'text',
        value: minerFee
      })
    }

    return [...inputNodes, ...blockNode, ...outputNodes] as Node[]
  }, [
    inputArray,
    outputArray,
    safeTxSize,
    safeTxVsize,
    minerFee,
    feeRateProp,
    satsToFiat,
    fiatCurrency,
    ownAddresses
  ])

  const sankeyLinks = useMemo(() => {
    if (inputArray.length === 0 || outputArray.length === 0) {
      return []
    }

    const inputToBlockLinks = inputArray.map((input, index) => ({
      source: String(index + 1),
      target: String(inputArray.length + 1),
      value: input.value,
      y1: 0
    }))

    const blockToOutputLinks = outputArray.map((output, index) => ({
      source: String(inputArray.length + 1),
      target: String(index + inputArray.length + 2),
      value: output.amount
    }))

    if (minerFee && minerFee > 0) {
      blockToOutputLinks.push({
        source: String(inputArray.length + 1),
        target: String(inputArray.length + outputArray.length + 2),
        value: minerFee
      })
    }

    return [...inputToBlockLinks, ...blockToOutputLinks]
  }, [inputArray, outputArray, minerFee])

  // Validate data before passing to sankey generator to prevent NaN values
  const validSankeyNodes = sankeyNodes.filter(
    (node) =>
      node &&
      typeof node.value === 'number' &&
      !Number.isNaN(node.value) &&
      node.value >= 0
  )

  const validSankeyLinks = sankeyLinks.filter(
    (link) =>
      link &&
      typeof link.value === 'number' &&
      !Number.isNaN(link.value) &&
      link.value > 0 &&
      link.source &&
      link.target
  )

  const { links, nodes } = sankeyGenerator({
    links: validSankeyLinks,
    nodes: validSankeyNodes
  })

  // calculating the sankey node styles to match in skia
  const nodeStyles = useMemo(() => {
    return nodes.map((node) => {
      const isBlock = (node as Node).type === 'block'
      const blockNodeHeight =
        isBlock && (node as Node).ioData?.txSize
          ? ((node as Node).ioData?.txSize ?? 0) * 0.1
          : 0

      // Safely handle NaN values from sankey generator
      const safeX0 = Number.isNaN(node.x0) ? 0 : (node.x0 ?? 0)
      const safeY0 = Number.isNaN(node.y0) ? 0 : (node.y0 ?? 0)

      return {
        height: isBlock ? Math.max(blockNodeHeight, LINK_MAX_WIDTH) : 80,
        localId: (node as Node).localId,
        width: isBlock ? BLOCK_WIDTH : NODE_WIDTH,
        x: isBlock ? safeX0 + (NODE_WIDTH - BLOCK_WIDTH) / 2 : safeX0,
        y: safeY0
      }
    })
  }, [nodes])

  const transformedLinks = links.map((link) => ({
    source: (link.source as Node).id,
    target: (link.target as Node).id,
    value: link.value
  }))

  const maxDepthH = 2

  if (inputMap.size === 0 || outputArray.length === 0) {
    return null
  }

  // Check for invalid fee rate
  if (Number.isNaN(feeRateProp) || feeRateProp < 0) {
    return null
  }

  if (!nodes?.length || !transformedLinks?.length) {
    return null
  }

  // Additional safety check: ensure all nodes have valid positions
  const hasInvalidNodes = nodes.some(
    (node) =>
      Number.isNaN(node.x0) ||
      Number.isNaN(node.y0) ||
      Number.isNaN(node.x1) ||
      Number.isNaN(node.y1)
  )

  if (hasInvalidNodes) {
    return null
  }

  return (
    <View style={{ flex: 1, height: GRAPH_HEIGHT }}>
      <Canvas
        style={{ height: GRAPH_HEIGHT, width: GRAPH_WIDTH }}
        onLayout={onCanvasLayout}
        pointerEvents="box-none"
      >
        <Group origin={{ x: w / 2, y: h / 2 }} transform={transform}>
          <SSSankeyLinks
            links={transformedLinks}
            nodes={nodes as Node[]}
            sankeyGenerator={sankeyGenerator}
            BLOCK_WIDTH={BLOCK_WIDTH}
          />
          <SSSankeyNodes
            nodes={nodes as Node[]}
            sankeyGenerator={sankeyGenerator}
            selectedOutputNode={currentOutputLocalId}
          />
          {nodes.map((node, index) => {
            const typedNode = node as Node
            const style = nodeStyles[index] // Get corresponding style for width/height
            const width = style.width + 20
            if (typedNode.depthH === maxDepthH) {
              const cy = style.y + 6.5 // 5px top padding + 1.5px circle center offset

              const circle1Cx = style.x + width - 31 // style.x + style.width - 16 (right padding + icon width) + 1.48926 (circle cx in icon)
              const circle2Cx = style.x + width - 35 // style.x + style.width - 16 + 5.48926
              const circle3Cx = style.x + width - 39 // style.x + style.width - 16 + 9.48926

              return (
                <Group key={`ellipsis-${typedNode.id}`}>
                  <Circle cx={circle1Cx} cy={cy} r={1} color="#D9D9D9" />
                  <Circle cx={circle2Cx} cy={cy} r={1} color="#D9D9D9" />
                  <Circle cx={circle3Cx} cy={cy} r={1} color="#D9D9D9" />
                </Group>
              )
            }
            return null
          })}
        </Group>
      </Canvas>
      <GestureDetector gesture={gestures}>
        <View style={styles.gestureContainer}>
          <Animated.View
            style={[
              styles.sankeyOverlay,
              { height: GRAPH_HEIGHT, width: GRAPH_WIDTH },
              animatedStyle
            ]}
            onLayout={onCanvasLayout}
          >
            {nodeStyles.map((style, index) => (
              <TouchableOpacity
                key={style.localId ?? index}
                style={[
                  styles.node,
                  {
                    height: style.height,
                    left: style.x,
                    position: 'absolute',
                    top: style.y,
                    width: style.width
                  }
                ]}
                onPress={
                  (nodes[index] as Node).depthH === maxDepthH && onPressOutput
                    ? () => onPressOutput(style.localId)
                    : undefined
                }
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  gestureContainer: {
    bottom: 0,
    flex: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  node: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    height: '100%',
    width: '100%'
  },
  sankeyOverlay: {
    position: 'relative'
  }
})

const thresholdCheck = (props: SSCurrentTransactionChartProps) =>
  props.inputs.size + props.outputs.length > SAFE_LIMIT_OF_INPUTS_OUTPUTS

export default withPerformanceWarning<SSCurrentTransactionChartProps>(
  SSCurrentTransactionChart,
  thresholdCheck,
  t('transaction.chart.warning')
)
