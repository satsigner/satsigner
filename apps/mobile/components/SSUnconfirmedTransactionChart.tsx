import { Canvas, Group } from '@shopify/react-native-skia'
import { sankey, type SankeyNodeMinimal } from 'd3-sankey'
import { useMemo } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { useLayout } from '@/hooks/useLayout'
import type { TxNode } from '@/hooks/useNodesAndLinks'
import { t } from '@/locales'
import type { Output } from '@/types/models/Output'
import type { Utxo } from '@/types/models/Utxo'
import { BLOCK_WIDTH } from '@/types/ui/sankey'
import { formatAddress } from '@/utils/format'
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

type SSUnconfirmedTransactionChartProps = {
  inputs: Map<string, Utxo>
  outputs: (Omit<Output, 'to'> & { to?: string })[]
  feeRate: number
}

function SSUnconfirmedTransactionChart({
  inputs: inputMap,
  outputs: outputArray,
  feeRate: feeRateProp
}: SSUnconfirmedTransactionChartProps) {
  const { size: txSize, vsize: txVsize } = estimateTransactionSize(
    inputMap.size,
    outputArray.length
  )

  const minerFee = useMemo(
    () => Math.round(feeRateProp * txVsize),
    [feeRateProp, txVsize]
  )

  const inputArray = useMemo(() => Array.from(inputMap.values()), [inputMap])

  const { width: w, height: h, onCanvasLayout } = useLayout()
  const { width } = useWindowDimensions()

  const maxInputOutputLength = Math.max(
    inputArray.length,
    outputArray.length + 1
  )

  const FIXED_BASE_HEIGHT = 400
  const SCALING_THRESHOLD = 3
  const GRAPH_HEIGHT =
    maxInputOutputLength > SCALING_THRESHOLD
      ? FIXED_BASE_HEIGHT *
        (1 + (maxInputOutputLength - SCALING_THRESHOLD) * 0.5)
      : FIXED_BASE_HEIGHT
  const GRAPH_WIDTH = width

  const sankeyGenerator = sankey()
    .nodeWidth(NODE_WIDTH)
    .nodePadding(GRAPH_HEIGHT / 2)
    .extent([
      [0, 20],
      [width, (GRAPH_HEIGHT * 0.75) / 2]
    ])
    .nodeId((node: SankeyNodeMinimal<object, object>) => (node as Node).id)

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
        address: formatAddress(input.txid, 3),
        label: input.label ?? t('common.noLabel'),
        value: input.value,
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
          txSize,
          vSize: txVsize,
          value: 0
        }
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
        address: output?.to ? formatAddress(output?.to, 4) : '',
        label: output.label,
        text: t('transaction.build.unspent')
      },
      value: output.amount
    }))

    if (minerFee !== undefined && minerFee > 0) {
      outputNodes.push({
        id: String(inputArray.length + outputArray.length + 2),
        type: 'text',
        depthH: 2,
        ioData: {
          value: minerFee,
          feeRate:
            feeRateProp !== undefined ? Math.round(feeRateProp) : undefined,
          text: t('transaction.build.minerFee')
        },
        value: minerFee,
        localId: 'minerFee'
      })
    }

    return [...inputNodes, ...blockNode, ...outputNodes] as Node[]
  }, [inputArray, outputArray, txSize, txVsize, minerFee, feeRateProp])

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

  const { nodes, links } = sankeyGenerator({
    nodes: sankeyNodes,
    links: sankeyLinks
  })

  const transformedLinks = links.map((link) => ({
    source: (link.source as Node).id,
    target: (link.target as Node).id,
    value: link.value
  }))

  if (inputMap.size === 0 || outputArray.length === 0) {
    return null
  }

  if (!nodes?.length || !transformedLinks?.length) {
    return null
  }

  return (
    <View style={{ flex: 1, height: GRAPH_HEIGHT / 2 }}>
      <Canvas
        style={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT / 2 }}
        onLayout={onCanvasLayout}
      >
        <Group origin={{ x: w / 2, y: h / 2 }}>
          <SSSankeyLinks
            links={transformedLinks}
            nodes={nodes as Node[]}
            sankeyGenerator={sankeyGenerator}
            LINK_MAX_WIDTH={LINK_MAX_WIDTH}
            BLOCK_WIDTH={BLOCK_WIDTH}
          />
          <SSSankeyNodes nodes={nodes} sankeyGenerator={sankeyGenerator} />
        </Group>
      </Canvas>
    </View>
  )
}

export default SSUnconfirmedTransactionChart
