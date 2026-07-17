import { Canvas, Group } from '@shopify/react-native-skia'
import { sankey, type SankeyNodeMinimal } from 'd3-sankey'
import { router } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  InteractionManager,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { useLayout } from '@/hooks/useLayout'
import type { TxNode } from '@/hooks/useNodesAndLinks'
import { useTransactionOutspends } from '@/hooks/useTransactionOutspends'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { type Transaction } from '@/types/models/Transaction'
import {
  BLOCK_WIDTH,
  NODE_WIDTH,
  SANKEY_DIAGRAM_NODE_PADDING_PX,
  SANKEY_EQUAL_ROW_MIN_SLOT_PX,
  SAFE_LIMIT_OF_INPUTS_OUTPUTS
} from '@/types/ui/sankey'
import { isChangeOutputAddress, normalizeAddressSet } from '@/utils/address'
import {
  equalizeSankeyColumnsByDepthH,
  minSankeyStackedColumnInnerHeightPx
} from '@/utils/equalizeSankeyColumnLayout'
import { getFeePercentage, isHighMinerFee } from '@/utils/feeWarnings'
import { formatAddress, formatNumber, formatTxId } from '@/utils/format'
import { buildSankeyRibbonPlan } from '@/utils/sankeyFlowWidths'
import { resolveSankeyInputLabel } from '@/utils/sankeyInputLabel'
import {
  resolveChartOutputSpendStatus,
  type ChartOutputSpendStatus
} from '@/utils/sankeyOutputLabel'
import { classifyChartOutputs } from '@/utils/stonewall'

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
}

type SSTransactionChartProps = {
  transaction: Transaction
  /** Account id used to open previous-input / spending-output transaction details. */
  accountId?: string
  /** Labels keyed by transaction id — used for input outpoint labels. */
  txLabelsById?: Map<string, string> | Record<string, string>
  /** Labels keyed by `txid:vout` for the consumed UTXO. */
  outpointLabelsByRef?: Map<string, string> | Record<string, string>
  /** Wallet transaction ids that can be opened from input / spent-output links. */
  knownTxIds?: ReadonlySet<string>
  /** Spending tx id keyed by spent outpoint (`txid:vout`). */
  spendingTxIdsByOutpoint?: Map<string, string> | Record<string, string>
  ownAddresses?: Set<string> // NEW: prop for own addresses
  /** Wallet change (internal) addresses for identifying change outputs. */
  internalAddresses?: Set<string>
  /** Wallet UTXO outpoints (`txid:vout`) still unspent on-chain. */
  unspentOutpoints?: Set<string>
  selectedOutputIndex?: number // Index of the output to highlight (vout)
  dimUnselected?: boolean // Dim non-selected outputs
  scale?: number // Scale factor for the chart (0-1)
  /** When false, hides the “unspent” line on outputs (e.g. preview before broadcast). */
  showUnspentLabel?: boolean
  /** Called with `false` once the chart (including labels) has painted. */
  onLoadingChange?: (loading: boolean) => void
}

function getSpendingTxId(
  map: Map<string, string> | Record<string, string> | undefined,
  outpoint: string
): string | undefined {
  if (!map) {
    return undefined
  }
  const value = map instanceof Map ? map.get(outpoint) : map[outpoint]
  return value?.trim() || undefined
}

const CHART_LOADING_MIN_HEIGHT = 200

type SankeyHitTargetProps = {
  accountId: string
  height: number
  knownTxIds?: ReadonlySet<string>
  linkedTxId: string
  width: number
  x: number
  y: number
}

function SankeyHitTarget({
  accountId,
  height,
  knownTxIds,
  linkedTxId,
  width,
  x,
  y
}: SankeyHitTargetProps) {
  function handlePress() {
    if (knownTxIds && !knownTxIds.has(linkedTxId)) {
      return
    }
    router.push(
      `/signer/bitcoin/account/${accountId}/transaction/${linkedTxId}`
    )
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('transaction.id')}
      onPress={handlePress}
      style={[
        styles.hitTarget,
        {
          height,
          left: x,
          top: y,
          width
        }
      ]}
    />
  )
}

function SSTransactionChart(props: SSTransactionChartProps) {
  const scale = props.scale ?? 1
  const [mountCanvas, setMountCanvas] = useState(false)

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setMountCanvas(true)
    })
    return () => task.cancel()
  }, [])

  return (
    <View
      style={[
        styles.chartShell,
        { minHeight: CHART_LOADING_MIN_HEIGHT * scale }
      ]}
    >
      {mountCanvas ? <SSTransactionChartCanvas {...props} /> : null}
    </View>
  )
}

function SSTransactionChartCanvas({
  transaction,
  accountId,
  txLabelsById,
  outpointLabelsByRef,
  knownTxIds,
  spendingTxIdsByOutpoint,
  ownAddresses = new Set(),
  internalAddresses = new Set(),
  unspentOutpoints,
  selectedOutputIndex,
  dimUnselected = false,
  scale = 1,
  showUnspentLabel = true,
  onLoadingChange
}: SSTransactionChartProps) {
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const normalizedOwnAddresses = useMemo(
    () => normalizeAddressSet(ownAddresses),
    [ownAddresses]
  )
  const normalizedInternalAddresses = useMemo(
    () => normalizeAddressSet(internalAddresses),
    [internalAddresses]
  )

  const totalOutputValue = transaction.vout.reduce(
    (prevValue, output) => prevValue + output.value,
    0
  )

  const defaultInputValue = totalOutputValue / (transaction.vin.length || 1)

  const inputs = transaction.vin.map((input) => ({
    label: input.label || '',
    txid: input.previousOutput.txid,
    value: input.value || defaultInputValue,
    valueIsKnown: input.value !== undefined,
    vout: input.previousOutput.vout
  }))

  const outputs = transaction.vout.map((output) => ({
    address: output.address,
    kind: output.kind,
    label: output.label || '',
    value: output.value
  }))

  const canDrawStructure =
    inputs.length > 0 &&
    outputs.length > 0 &&
    transaction.vin.length > 0 &&
    transaction.vout.length > 0

  const onLoadingChangeRef = useRef(onLoadingChange)
  onLoadingChangeRef.current = onLoadingChange

  const structureNotifiedRef = useRef(false)
  const [labelsReady, setLabelsReady] = useState(false)

  useEffect(() => {
    structureNotifiedRef.current = false
    setLabelsReady(false)
  }, [transaction.id])

  useEffect(() => {
    if (structureNotifiedRef.current) {
      return
    }

    if (!canDrawStructure) {
      structureNotifiedRef.current = true
      onLoadingChangeRef.current?.(false)
      return
    }

    if (!labelsReady) {
      return
    }

    structureNotifiedRef.current = true
    onLoadingChangeRef.current?.(false)
  }, [canDrawStructure, labelsReady, transaction.id])

  const pendingOutspendOutputs: { address: string; vout: number }[] = []
  if (unspentOutpoints && canDrawStructure) {
    for (const [index, output] of outputs.entries()) {
      const outpoint = `${transaction.id}:${index}`
      const status = resolveChartOutputSpendStatus({
        outpoint,
        spendingTxIdsByOutpoint,
        unspentOutpoints
      })
      if (status !== 'pending') {
        continue
      }
      const address = output.address.trim()
      if (!address) {
        continue
      }
      pendingOutspendOutputs.push({ address, vout: index })
    }
  }

  const { data: networkOutspends } = useTransactionOutspends({
    enabled: labelsReady && pendingOutspendOutputs.length > 0,
    outputs: pendingOutspendOutputs,
    txid: transaction.id
  })

  const minerFee = inputs.every((input) => input.valueIsKnown)
    ? inputs.reduce((prevValue, input) => prevValue + input.value, 0) -
      totalOutputValue
    : undefined

  const txSize = transaction.size
  const txVsize = transaction.vsize

  const feeRate =
    minerFee !== undefined && txVsize !== undefined && txVsize > 0
      ? minerFee / txVsize
      : undefined

  const { onCanvasLayout } = useLayout()
  const { width } = useWindowDimensions()

  // output.length + 1 because of mining fee
  const maxInputOutputLength = Math.max(inputs.length, outputs.length + 1)

  // Fixed base height with dynamic scaling for larger transactions
  const FIXED_BASE_HEIGHT = 400
  const SCALING_THRESHOLD = 2.4 // Start scaling when more than 5 inputs or outputs
  const BASE_GRAPH_HEIGHT =
    maxInputOutputLength > SCALING_THRESHOLD
      ? FIXED_BASE_HEIGHT *
        (1 + (maxInputOutputLength - SCALING_THRESHOLD) * 0.5)
      : FIXED_BASE_HEIGHT
  const GRAPH_HEIGHT = BASE_GRAPH_HEIGHT * scale
  const GRAPH_WIDTH = width * scale

  const gapScaled = Math.round(SANKEY_DIAGRAM_NODE_PADDING_PX * scale)
  const minSlotScaled = SANKEY_EQUAL_ROW_MIN_SLOT_PX * scale
  const feeRowCount = minerFee !== undefined ? 1 : 0
  const maxColumnNodes = Math.max(
    inputs.length,
    outputs.length + feeRowCount,
    1
  )
  const minColumnInnerRequired = minSankeyStackedColumnInnerHeightPx(
    maxColumnNodes,
    minSlotScaled,
    gapScaled
  )

  const sankeyExtentTop = 20 * scale
  const legacyExtentBottom = (GRAPH_HEIGHT * 0.65) / 2
  const legacyInner = legacyExtentBottom - sankeyExtentTop
  const innerHeight = Math.max(legacyInner, minColumnInnerRequired)
  const sankeyExtentBottom = sankeyExtentTop + innerHeight

  /** Bottom padding so the last row / ribbons are not clipped by the canvas. */
  const chartBottomBleedPx = 6 * scale
  const chartCanvasHeight = sankeyExtentBottom + chartBottomBleedPx

  const sankeyGenerator = sankey()
    .nodeWidth(NODE_WIDTH * scale)
    .nodePadding(gapScaled)
    .extent([
      [0, sankeyExtentTop],
      [GRAPH_WIDTH * 0.9, sankeyExtentBottom]
    ])
    .nodeId((node: SankeyNodeMinimal<object, object>) => (node as Node).id)

  sankeyGenerator.nodeAlign((node: SankeyNodeMinimal<object, object>) => {
    const { depthH } = node as Node
    return depthH ?? 0
  })

  const sankeyNodes = useMemo(() => {
    if (inputs.length === 0 || outputs.length === 0) {
      return []
    }

    const inputNodes: TxNode[] = inputs.map((input, index) => ({
      depthH: 0,
      id: String(index + 1),
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
        value: input.valueIsKnown ? input.value : 0,
        vout: input.vout
      },
      type: 'text',
      value: input.value,
      vout: input.vout
    }))

    const blockNode: TxNode[] = [
      {
        depthH: 1,
        id: String(inputs.length + 1),
        ioData: {
          txSize,
          vSize: txVsize,
          value: totalOutputValue
        },
        type: 'block',
        value: totalOutputValue
      }
    ]

    const outputFlags = classifyChartOutputs(
      outputs.map((output, index) => ({
        kind: output.kind,
        label: output.label ?? '',
        localId: `output-${index}`,
        to: output.address.trim(),
        value: output.value
      })),
      normalizedOwnAddresses,
      { isWalletSend: transaction.type === 'send' }
    )

    const outputNodes: TxNode[] = outputs.map((output, index) => {
      const nodeId = String(index + 2 + inputs.length)
      const label = output.label ?? ''
      const outputAddress = output.address.trim()
      const { isChange, isFakeMix, isReceive, isSelfSend } = outputFlags[
        index
      ] ?? {
        isChange: false,
        isFakeMix: false,
        isReceive: false,
        isSelfSend: false
      }
      // Sparrow: wallet-owned / change-chain outputs stay green; only external
      // payments are spends. Equal-amount owned peers of a 4-out stonewall are
      // fake-mix (not change/self-send) for the chart label + icon.
      const isChangeOutput =
        !isFakeMix &&
        (isChange ||
          isChangeOutputAddress(outputAddress, normalizedInternalAddresses))
      const isSelfSendOutput = !isChangeOutput && !isFakeMix && isSelfSend
      const isReceiveOutput =
        !isChangeOutput && !isFakeMix && !isSelfSendOutput && isReceive
      const outpoint = `${transaction.id}:${index}`
      const localSpendStatus = resolveChartOutputSpendStatus({
        outpoint,
        spendingTxIdsByOutpoint,
        unspentOutpoints
      })
      const networkOutspend = networkOutspends?.get(index)
      const spendStatus: ChartOutputSpendStatus = networkOutspend
        ? networkOutspend.spent
          ? 'spent'
          : 'unspent'
        : localSpendStatus
      const isUnspent = spendStatus === 'unspent'
      const nextTx =
        spendStatus === 'spent'
          ? (networkOutspend?.spendingTxId ??
            getSpendingTxId(spendingTxIdsByOutpoint, outpoint))
          : undefined

      return {
        depthH: 2,
        id: nodeId,
        ioData: {
          address: formatAddress(output.address, 6),
          fiatCurrency,
          fiatValue: formatNumber(satsToFiat(output.value), 2),
          isChange: isChangeOutput,
          isFakeMix,
          isReceive: isReceiveOutput,
          isSelfSend: isSelfSendOutput,
          isUnspent,
          label: label || t('common.noLabel'),
          text:
            spendStatus === 'pending'
              ? '?'
              : spendStatus === 'unspent'
                ? t('transaction.build.unspent')
                : t('transaction.build.spent'),
          value: output.value
        },
        localId: `output-${index}`,
        nextTx,
        type: 'text',
        value: output.value
      }
    })

    const higherFee =
      minerFee !== undefined &&
      isHighMinerFee({
        minerFeeSats: minerFee,
        totalOutputSats: totalOutputValue
      })

    const feePercentage =
      minerFee !== undefined
        ? getFeePercentage({
            minerFeeSats: minerFee,
            totalOutputSats: totalOutputValue
          })
        : 0

    if (minerFee !== undefined) {
      outputNodes.push({
        depthH: 2,
        id: String(inputs.length + outputs.length + 2),
        ioData: {
          feePercentage: Math.round(feePercentage * 10000) / 100,
          feeRate: feeRate !== undefined ? Math.round(feeRate) : undefined,
          fiatCurrency,
          fiatValue: formatNumber(satsToFiat(minerFee), 2),
          higherFee,
          text: t('transaction.build.minerFee'),
          value: minerFee // round to 2 decimals
        },
        localId: 'past-minerFee',
        type: 'text',
        value: minerFee
      })
    }

    return [...inputNodes, ...blockNode, ...outputNodes] as Node[]
  }, [
    inputs,
    outputs,
    txSize,
    txVsize,
    minerFee,
    feeRate,
    satsToFiat,
    fiatCurrency,
    totalOutputValue,
    normalizedOwnAddresses,
    normalizedInternalAddresses,
    unspentOutpoints,
    spendingTxIdsByOutpoint,
    networkOutspends,
    transaction.id,
    transaction.type,
    txLabelsById,
    outpointLabelsByRef
  ])

  const sankeyLinks = useMemo(() => {
    if (inputs.length === 0 || outputs.length === 0) {
      return []
    }

    const inputToBlockLinks = inputs.map((input, index) => ({
      source: String(index + 1),
      target: String(inputs.length + 1),
      value: input.value,
      y1: 0
    }))

    const blockToOutputLinks = outputs.map((output, index) => ({
      source: String(inputs.length + 1),
      target: String(index + inputs.length + 2),
      value: output.value
    }))

    if (minerFee) {
      blockToOutputLinks.push({
        source: String(inputs.length + 1),
        target: String(inputs.length + outputs.length + 2),
        value: minerFee
      })
    }

    return [...inputToBlockLinks, ...blockToOutputLinks]
  }, [inputs, outputs, minerFee])

  if (inputs.length === 0 || outputs.length === 0) {
    return <View style={{ height: GRAPH_HEIGHT / 2, overflow: 'hidden' }} />
  }

  if (transaction.vin.length === 0 || transaction.vout.length === 0) {
    return <View style={{ height: GRAPH_HEIGHT / 2, overflow: 'hidden' }} />
  }

  const layoutResult = sankeyGenerator({
    links: sankeyLinks,
    nodes: sankeyNodes
  })

  equalizeSankeyColumnsByDepthH(
    layoutResult.nodes as Node[],
    sankeyExtentTop,
    sankeyExtentBottom,
    gapScaled,
    minSlotScaled
  )

  const { links, nodes } = layoutResult

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

  if (!nodes?.length || !transformedLinks?.length) {
    return <View style={{ height: GRAPH_HEIGHT / 2, overflow: 'hidden' }} />
  }

  const nodeWidth = NODE_WIDTH * scale
  const hitMinHeight = 52 * scale
  const hitMinWidth = 160 * scale

  function buildHitTarget(
    node: Node,
    linkedTxId: string
  ): {
    height: number
    id: string
    linkedTxId: string
    width: number
    x: number
    y: number
  } {
    const safeX0 = Number.isNaN(node.x0) ? 0 : (node.x0 ?? 0)
    const safeY0 = Number.isNaN(node.y0) ? 0 : (node.y0 ?? 0)
    const safeY1 = Number.isNaN(node.y1) ? 0 : (node.y1 ?? 0)
    return {
      height: Math.max(safeY1 - safeY0, hitMinHeight),
      id: node.id,
      linkedTxId,
      width: Math.max(nodeWidth, hitMinWidth),
      x: safeX0,
      y: safeY0 - 2 * scale
    }
  }

  const inputHitTargets = (nodes as Node[]).flatMap((node) => {
    const prevTxId = node.ioData?.prevTxId
    if (!node.ioData?.isInput || !prevTxId) {
      return []
    }
    if (knownTxIds && !knownTxIds.has(prevTxId)) {
      return []
    }
    return [buildHitTarget(node, prevTxId)]
  })

  const outputHitTargets = (nodes as Node[]).flatMap((node) => {
    const { nextTx } = node
    if (node.ioData?.isInput || node.ioData?.isUnspent !== false || !nextTx) {
      return []
    }
    if (knownTxIds && !knownTxIds.has(nextTx)) {
      return []
    }
    return [buildHitTarget(node, nextTx)]
  })

  return (
    <View style={{ flex: 1, height: chartCanvasHeight, overflow: 'hidden' }}>
      <View onLayout={onCanvasLayout} style={styles.chartHost}>
        <Canvas
          style={{ height: chartCanvasHeight, width: GRAPH_WIDTH }}
          pointerEvents="none"
        >
          <Group
            origin={{
              x: GRAPH_WIDTH / 2,
              y: chartCanvasHeight / 2
            }}
          >
            <SSSankeyLinks
              links={transformedLinks}
              nodes={nodes as Node[]}
              ribbonPlan={ribbonPlan}
              sankeyGenerator={sankeyGenerator}
              BLOCK_WIDTH={BLOCK_WIDTH}
              selectedOutputNode={
                selectedOutputIndex !== undefined
                  ? `output-${selectedOutputIndex}`
                  : undefined
              }
              dimUnselected={dimUnselected}
            />
            <SSSankeyNodes
              nodes={nodes as Node[]}
              ribbonPlan={ribbonPlan}
              sankeyGenerator={sankeyGenerator}
              selectedOutputNode={
                selectedOutputIndex !== undefined
                  ? `output-${selectedOutputIndex}`
                  : undefined
              }
              dimUnselected={dimUnselected}
              showUnspentLabel={showUnspentLabel}
              onLabelsReady={setLabelsReady}
            />
          </Group>
        </Canvas>
        {accountId
          ? [...inputHitTargets, ...outputHitTargets].map((target) => (
              <SankeyHitTarget
                key={target.id}
                accountId={accountId}
                knownTxIds={knownTxIds}
                linkedTxId={target.linkedTxId}
                height={target.height}
                width={target.width}
                x={target.x}
                y={target.y}
              />
            ))
          : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chartHost: {
    position: 'relative'
  },
  chartShell: {
    position: 'relative'
  },
  hitTarget: {
    position: 'absolute'
  }
})

const thresholdCheck = ({ transaction }: SSTransactionChartProps) =>
  transaction.vin.length + transaction.vout.length >
  SAFE_LIMIT_OF_INPUTS_OUTPUTS

export default withPerformanceWarning<SSTransactionChartProps>(
  SSTransactionChart,
  thresholdCheck,
  t('transaction.chart.warning')
)
