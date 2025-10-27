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
import { BLOCK_WIDTH } from '@/types/ui/sankey'
import { formatAddress, formatNumber } from '@/utils/format'
import { estimateTransactionSize } from '@/utils/transaction'

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

const LINK_MAX_WIDTH = 60
const NODE_WIDTH = 98

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
    width: w,
    height: h,
    center,
    isDoubleTapEnabled: true,
    maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
    minPanPointers: 1,
    maxScale: 20,
    minScale: 0.2,
    shouldResetOnInteractionEnd: false
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
    if (inputArray.length === 0 || outputArray.length === 0) return []

    const inputNodes: TxNode[] = inputArray.map((input, index) => ({
      id: String(index + 1),
      type: 'text',
      depthH: 0,
      ioData: {
        address: formatAddress(input.txid, 4),
        label: input.label ?? t('common.noLabel'),
        value: input.value,
        fiatValue: formatNumber(satsToFiat(input.value), 2),
        fiatCurrency,
        text: t('common.from')
      },
      value: input.value
    }))

    const blockNode: TxNode[] = [
      {
        id: String(inputArray.length + 1),
        type: 'block',
        depthH: 1,
        ioData: {
          txSize: safeTxSize,
          vSize: safeTxVsize,
          value: 0
        },
        value: 0
      }
    ]

    const outputNodes: TxNode[] = outputArray.map((output, index) => ({
      id: String(index + 2 + inputArray.length),
      type: 'text',
      depthH: 2,
      localId: output.to ? output.localId : 'remainingBalance',
      ioData: {
        isUnspent: true,
        value: output.amount,
        fiatValue: formatNumber(satsToFiat(output.amount), 2),
        fiatCurrency,
        address: output?.to ? formatAddress(output?.to, 6) : '',
        label: output.label,
        text: t('transaction.build.unspent'),
        isSelfSend: !!(output.to && ownAddresses.has(output.to))
      },
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
        id: String(inputArray.length + outputArray.length + 2),
        type: 'text',
        depthH: 2,
        ioData: {
          value: minerFee,
          fiatValue: formatNumber(satsToFiat(minerFee), 2),
          fiatCurrency,
          feeRate:
            feeRateProp !== undefined ? Math.round(feeRateProp) : undefined,
          text: t('transaction.build.minerFee'),
          higherFee,
          feePercentage: Math.round(feePercentage * 100) / 100 // round to 2 decimals
        },
        value: minerFee,
        localId: 'current-minerFee'
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
    if (inputArray.length === 0 || outputArray.length === 0) return []

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

  const { nodes, links } = sankeyGenerator({
    nodes: validSankeyNodes,
    links: validSankeyLinks
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
      const safeX0 = Number.isNaN(node.x0) ? 0 : node.x0 ?? 0
      const safeY0 = Number.isNaN(node.y0) ? 0 : node.y0 ?? 0

      return {
        localId: (node as Node).localId,
        x: isBlock ? safeX0 + (NODE_WIDTH - BLOCK_WIDTH) / 2 : safeX0,
        y: safeY0,
        width: isBlock ? BLOCK_WIDTH : NODE_WIDTH,
        height: isBlock ? Math.max(blockNodeHeight, LINK_MAX_WIDTH) : 80
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
        style={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
        onLayout={onCanvasLayout}
      >
        <Group origin={{ x: w / 2, y: h / 2 }} transform={transform}>
          <SSSankeyLinks
            links={transformedLinks}
            nodes={nodes as Node[]}
            sankeyGenerator={sankeyGenerator}
            LINK_MAX_WIDTH={LINK_MAX_WIDTH}
            BLOCK_WIDTH={BLOCK_WIDTH}
          />
          <SSSankeyNodes
            nodes={nodes}
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
              { width: GRAPH_WIDTH, height: GRAPH_HEIGHT },
              animatedStyle
            ]}
            onLayout={onCanvasLayout}
          >
            {nodeStyles.map((style, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.node,
                  {
                    position: 'absolute',
                    left: style.x,
                    top: style.y,
                    width: style.width,
                    height: style.height
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
    flex: 1,
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  },
  sankeyOverlay: {
    position: 'relative'
  },
  node: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    width: '100%',
    height: '100%'
  }
})

export default SSCurrentTransactionChart
