import { Canvas, Group } from '@shopify/react-native-skia'
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
import type { TxNode } from '@/hooks/useNodesAndLinks'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import type { Output } from '@/types/models/Output'
import type { Utxo } from '@/types/models/Utxo'
import {
  BLOCK_WIDTH,
  LINK_MAX_WIDTH,
  NODE_WIDTH,
  SANKEY_CURRENT_TX_EXTENT_MIN_INNER_HEIGHT_PX,
  SANKEY_CURRENT_TX_EXTENT_ROW_SCALE,
  SANKEY_CURRENT_TX_EXTENT_X_INSET_PX,
  SANKEY_CURRENT_TX_EQUAL_ROW_MIN_SLOT_PX,
  SANKEY_CURRENT_TX_NODE_PADDING_PX,
  SAFE_LIMIT_OF_INPUTS_OUTPUTS,
  getSankeyExtentTopPx
} from '@/types/ui/sankey'
import {
  equalizeSankeyColumnsByDepthH,
  minSankeyStackedColumnInnerHeightPx
} from '@/utils/equalizeSankeyColumnLayout'
import { getFeePercentage, isHighMinerFee } from '@/utils/feeWarnings'
import { formatAddress, formatNumber, formatTxId } from '@/utils/format'
import { buildSankeyRibbonPlan } from '@/utils/sankeyFlowWidths'
import { resolveSankeyInputLabel } from '@/utils/sankeyInputLabel'
import {
  CHART_REMAINING_BALANCE_LOCAL_ID,
  classifyChartOutputs
} from '@/utils/stonewall'
import { estimateTransactionSize } from '@/utils/transaction'
import {
  getOutputMaxAllowedSats,
  isTransactionUnderfunded
} from '@/utils/transactionFunding'
import { getUtxoOutpoint } from '@/utils/utxo'

import { withPerformanceWarning } from './SSPerformanceWarning'
import SSSankeyLinks from './SSSankeyLinks'
import SSSankeyNodes from './SSSankeyNodes'
import SSText from './SSText'

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
  inputOutpoint?: string
}

type SSCurrentTransactionChartProps = {
  inputs: Map<string, Utxo>
  outputs: (Omit<Output, 'to'> & { to?: string })[]
  feeRate: number
  effectiveMinerFeeSats?: number
  elevatedFeeRateHighlight?: boolean
  suppressUnderfundedWarning?: boolean
  onPressInput?: (outpoint: string) => void
  onPressOutput?: (localId?: string) => void
  currentOutputLocalId?: string
  ownAddresses?: Set<string> // NEW: prop for own addresses
  /** Labels keyed by transaction id — used for input outpoint labels. */
  txLabelsById?: Map<string, string> | Record<string, string>
  /** Labels keyed by `txid:vout` for the consumed UTXO. */
  outpointLabelsByRef?: Map<string, string> | Record<string, string>
  overlayHeaderHeight?: number
}

function SSCurrentTransactionChart({
  inputs: inputMap,
  outputs: outputArray,
  feeRate: feeRateProp,
  effectiveMinerFeeSats,
  elevatedFeeRateHighlight = false,
  suppressUnderfundedWarning = false,
  onPressInput,
  onPressOutput,
  currentOutputLocalId,
  ownAddresses = new Set(),
  txLabelsById,
  outpointLabelsByRef,
  overlayHeaderHeight
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
    if (
      typeof effectiveMinerFeeSats === 'number' &&
      !Number.isNaN(effectiveMinerFeeSats) &&
      effectiveMinerFeeSats >= 0
    ) {
      return effectiveMinerFeeSats
    }

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
  }, [effectiveMinerFeeSats, feeRateProp, safeTxVsize])

  const { width: winW, height: winH } = useWindowDimensions()
  const safeWinW = Math.max(1, winW)
  const safeWinH = Math.max(1, winH)
  const GRAPH_WIDTH = safeWinW

  const SANKEY_EXTENT_BOTTOM_MARGIN_PX = 8
  const extentTopCap = getSankeyExtentTopPx(overlayHeaderHeight)

  const chartGeometry = useMemo(() => {
    const rowCount = Math.max(inputMap.size, outputArray.length + 1)
    const feeRows = minerFee > 0 ? 1 : 0
    const maxColumnNodes = Math.max(
      inputMap.size,
      outputArray.length + feeRows,
      1
    )
    const minInnerEqualRows = minSankeyStackedColumnInnerHeightPx(
      maxColumnNodes,
      SANKEY_CURRENT_TX_EQUAL_ROW_MIN_SLOT_PX,
      SANKEY_CURRENT_TX_NODE_PADDING_PX
    )
    const extentTop = extentTopCap
    const graphHeight = Math.max(
      safeWinH * 0.7,
      extentTop +
        SANKEY_CURRENT_TX_EXTENT_MIN_INNER_HEIGHT_PX +
        SANKEY_EXTENT_BOTTOM_MARGIN_PX,
      extentTop + minInnerEqualRows + SANKEY_EXTENT_BOTTOM_MARGIN_PX
    )
    const rawSankeyExtentBottomY =
      graphHeight * rowCount * SANKEY_CURRENT_TX_EXTENT_ROW_SCALE
    const sankeyExtentBottomY = Math.min(
      graphHeight - SANKEY_EXTENT_BOTTOM_MARGIN_PX,
      Math.max(
        extentTop + SANKEY_CURRENT_TX_EXTENT_MIN_INNER_HEIGHT_PX,
        rawSankeyExtentBottomY,
        extentTop + minInnerEqualRows
      )
    )

    return {
      extentTop,
      graphHeight,
      sankeyExtentBottomY
    }
  }, [extentTopCap, inputMap.size, minerFee, outputArray.length, safeWinH])

  const GRAPH_HEIGHT = chartGeometry.graphHeight
  const { extentTop } = chartGeometry
  const { sankeyExtentBottomY } = chartGeometry

  /** Same space as Skia coords & overlay — not useLayout (often 0×0 before layout). */
  const chartCenter = useMemo(
    () => ({ x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 }),
    [GRAPH_HEIGHT, GRAPH_WIDTH]
  )

  const { animatedStyle, gestures, transform } = useGestures({
    center: chartCenter,
    height: GRAPH_HEIGHT,
    isDoubleTapEnabled: true,
    maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
    maxScale: 20,
    minPanPointers: 1,
    minScale: 0.2,
    shouldResetOnInteractionEnd: false,
    width: GRAPH_WIDTH
  })

  const extentX1 = Math.max(
    SANKEY_CURRENT_TX_EXTENT_X_INSET_PX + 1,
    safeWinW - SANKEY_CURRENT_TX_EXTENT_X_INSET_PX
  )

  const sankeyGenerator = useMemo(() => {
    const gen = sankey()
      .nodeWidth(NODE_WIDTH)
      .nodePadding(SANKEY_CURRENT_TX_NODE_PADDING_PX)
      .extent([
        [SANKEY_CURRENT_TX_EXTENT_X_INSET_PX, extentTop],
        [extentX1, sankeyExtentBottomY]
      ])
      .nodeId((node: SankeyNodeMinimal<object, object>) => (node as Node).id)
    gen.nodeAlign((node: SankeyNodeMinimal<object, object>) => {
      const { depthH } = node as Node
      return depthH ?? 0
    })
    return gen
  }, [extentTop, extentX1, sankeyExtentBottomY])

  const sankeyNodes = useMemo(() => {
    if (inputArray.length === 0 || outputArray.length === 0) {
      return []
    }

    const inputNodes: TxNode[] = inputArray.map((input, index) => ({
      depthH: 0,
      id: String(index + 1),
      inputOutpoint: getUtxoOutpoint(input),
      ioData: {
        address: formatTxId(input.txid, 4),
        fiatCurrency,
        fiatValue: formatNumber(satsToFiat(input.value), 2),
        isInput: true,
        label: resolveSankeyInputLabel(
          input.txid,
          input.vout,
          txLabelsById,
          outpointLabelsByRef
        ),
        prevTxId: input.txid,
        text: t('common.from'),
        value: input.value,
        vout: input.vout
      },
      type: 'text',
      value: input.value,
      vout: input.vout
    }))

    const blockNode: TxNode[] = [
      {
        depthH: 1,
        id: String(inputArray.length + 1),
        ioData: {
          txSize: safeTxSize,
          vSize: safeTxVsize,
          value: totalInputValue
        },
        type: 'block',
        value: totalInputValue
      }
    ]

    const isUnderfunded =
      !suppressUnderfundedWarning &&
      isTransactionUnderfunded(totalInputValue, totalOutputValue, minerFee)
    const outputsTotal = outputArray.reduce(
      (sum, output) => sum + output.amount,
      0
    )

    const outputFlags = classifyChartOutputs(outputArray, ownAddresses, {
      isWalletSend: true
    })

    const outputNodes: TxNode[] = outputArray.map((output, index) => {
      const localId = output.to
        ? output.localId
        : CHART_REMAINING_BALANCE_LOCAL_ID
      const maxAllowedSats = getOutputMaxAllowedSats({
        minerFeeSats: minerFee,
        outputAmountSats: output.amount,
        outputsTotalSats: outputsTotal,
        totalInputSats: totalInputValue
      })

      return {
        depthH: 2,
        id: String(index + 2 + inputArray.length),
        ioData: {
          address: output?.to ? formatAddress(output?.to, 6) : '',
          fiatCurrency,
          fiatValue: formatNumber(satsToFiat(output.amount), 2),
          ...(outputFlags[index] ?? {
            isChange: false,
            isFakeMix: false,
            isReceive: false,
            isSelfSend: false
          }),
          isUnspent: true,
          label: output.label,
          maxAllowedSats:
            isUnderfunded && localId !== CHART_REMAINING_BALANCE_LOCAL_ID
              ? maxAllowedSats
              : undefined,
          value: output.amount
        },
        localId,
        type: 'text',
        value: output.amount
      }
    })

    if (minerFee !== undefined && minerFee > 0) {
      const totalOutputValueForFee = totalInputValue - minerFee

      const higherFee = isHighMinerFee({
        minerFeeSats: minerFee,
        totalOutputSats: totalOutputValueForFee
      })
      const elevatedFeeRate = elevatedFeeRateHighlight

      const feePercentage = getFeePercentage({
        minerFeeSats: minerFee,
        totalOutputSats: totalOutputValueForFee
      })

      outputNodes.push({
        depthH: 2,
        id: String(inputArray.length + outputArray.length + 2),
        ioData: {
          elevatedFeeRate,
          feePercentage: Math.round(feePercentage * 10000) / 100,
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
    totalInputValue,
    totalOutputValue,
    safeTxSize,
    safeTxVsize,
    minerFee,
    feeRateProp,
    elevatedFeeRateHighlight,
    satsToFiat,
    fiatCurrency,
    ownAddresses,
    suppressUnderfundedWarning,
    txLabelsById,
    outpointLabelsByRef
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

  const layoutResult = sankeyGenerator({
    links: validSankeyLinks,
    nodes: validSankeyNodes
  })

  equalizeSankeyColumnsByDepthH(
    layoutResult.nodes as Node[],
    extentTop,
    sankeyExtentBottomY,
    SANKEY_CURRENT_TX_NODE_PADDING_PX,
    SANKEY_CURRENT_TX_EQUAL_ROW_MIN_SLOT_PX
  )

  const { links, nodes } = layoutResult

  // calculating the sankey node styles to match in skia
  const nodeStyles = useMemo(
    () =>
      nodes.map((node) => {
        const isBlock = (node as Node).type === 'block'
        const blockNodeHeight =
          isBlock && (node as Node).ioData?.txSize
            ? ((node as Node).ioData?.txSize ?? 0) * 0.1
            : 0

        // Safely handle NaN values from sankey generator
        const safeX0 = Number.isNaN(node.x0) ? 0 : (node.x0 ?? 0)
        const safeY0 = Number.isNaN(node.y0) ? 0 : (node.y0 ?? 0)
        const safeY1 = Number.isNaN(node.y1) ? 0 : (node.y1 ?? 0)
        const slotHeight = Math.max(0, safeY1 - safeY0)

        return {
          height: isBlock
            ? Math.max(blockNodeHeight, LINK_MAX_WIDTH)
            : Math.max(slotHeight, 1),
          localId: (node as Node).localId,
          width: isBlock ? BLOCK_WIDTH : NODE_WIDTH,
          x: isBlock ? safeX0 + (NODE_WIDTH - BLOCK_WIDTH) / 2 : safeX0,
          y: safeY0
        }
      }),
    [nodes]
  )

  const transformedLinks = links.map((link) => ({
    source: (link.source as Node).id,
    target: (link.target as Node).id,
    value: link.value
  }))

  const ribbonPlan = buildSankeyRibbonPlan(
    nodes.map((node) => ({
      id: (node as Node).id,
      type: (node as Node).type,
      value: (node as Node).value
    })),
    transformedLinks
  )

  const maxDepthH = 2

  if (inputMap.size === 0 || outputArray.length === 0) {
    return null
  }

  // Check for invalid fee rate
  if (Number.isNaN(feeRateProp) || feeRateProp < 0) {
    return null
  }

  const graphEmpty = !nodes?.length || !transformedLinks?.length

  if (graphEmpty) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: extentTop
        }}
      >
        <SSText center color="muted" size="sm">
          {t('transaction.chart.unavailableHint')}
        </SSText>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, height: GRAPH_HEIGHT }}>
      <View>
        <Canvas
          style={{ height: GRAPH_HEIGHT, width: GRAPH_WIDTH }}
          pointerEvents="box-none"
        >
          <Group
            origin={{ x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 }}
            transform={transform}
          >
            <SSSankeyLinks
              links={transformedLinks}
              nodes={nodes as Node[]}
              ribbonPlan={ribbonPlan}
              sankeyGenerator={sankeyGenerator}
              BLOCK_WIDTH={BLOCK_WIDTH}
            />
            <SSSankeyNodes
              nodes={nodes as Node[]}
              ribbonPlan={ribbonPlan}
              sankeyGenerator={sankeyGenerator}
              selectedOutputNode={currentOutputLocalId}
              showUnspentLabel={false}
            />
          </Group>
        </Canvas>
      </View>
      <GestureDetector gesture={gestures}>
        <View style={styles.gestureContainer}>
          <Animated.View
            style={[
              styles.sankeyOverlay,
              { height: GRAPH_HEIGHT, width: GRAPH_WIDTH },
              animatedStyle
            ]}
          >
            {nodeStyles.map((style, index) => {
              const node = nodes[index] as Node
              const { inputOutpoint } = node

              return (
                <TouchableOpacity
                  key={style.localId ?? inputOutpoint ?? index}
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
                    inputOutpoint && onPressInput
                      ? () => onPressInput(inputOutpoint)
                      : node.depthH === maxDepthH && onPressOutput
                        ? () => onPressOutput(style.localId)
                        : undefined
                  }
                />
              )
            })}
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
