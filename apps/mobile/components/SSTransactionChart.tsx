import { Canvas, Group } from '@shopify/react-native-skia'
import { sankey, type SankeyNodeMinimal } from 'd3-sankey'
import { useMemo } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { useLayout } from '@/hooks/useLayout'
import { type Transaction } from '@/types/models/Transaction'
import { formatAddress } from '@/utils/format'

import SSSankeyLinks from './SSSankeyLinks'
import SSSankeyNodes from './SSSankeyNodes'

interface Node extends SankeyNodeMinimal<object, object> {
  id: string
  depth?: number
  depthH: number
  address?: string
  type: string
  textInfo: string[]
  value?: number
  txId?: string
  nextTx?: string
}

const LINK_MAX_WIDTH = 60
const BLOCK_WIDTH = 50
const NODE_WIDTH = 98

type SSTransactionChartProps = {
  transaction: Transaction
}

function SSTransactionChart({ transaction }: SSTransactionChartProps) {
  const totalOutputValue = transaction.vout.reduce((prevValue, output) => {
    return prevValue + output.value
  }, 0)

  const defaultInputValue = totalOutputValue / (transaction.vin.length || 1)

  const inputs = transaction.vin.map((input) => ({
    txid: input.previousOutput.txid,
    value: input.value || defaultInputValue,
    valueIsKnown: input.value !== undefined,
    label: input.label || ''
  }))

  const outputs = transaction.vout.map((output) => ({
    address: output.address,
    value: output.value,
    label: output.label || ''
  }))

  let minerFee: number | undefined
  if (inputs.every((input) => input.valueIsKnown)) {
    const totalInputValue = inputs.reduce((prevValue, input) => {
      return prevValue + input.value
    }, 0)
    minerFee = totalInputValue - totalOutputValue
  }

  const txSize = transaction.size || '?'
  const txVsize = transaction.vsize || '?'

  const { width: w, height: h, onCanvasLayout } = useLayout()
  const { width } = useWindowDimensions()

  // output.length + 1 because of mining fee
  const maxInputOutputLength = Math.max(inputs.length, outputs.length + 1)

  // Fixed base height with dynamic scaling for larger transactions
  const FIXED_BASE_HEIGHT = 400
  const SCALING_THRESHOLD = 3 // Start scaling when more than 5 inputs or outputs
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
      [width * 0.9, (GRAPH_HEIGHT * 0.75) / 2]
    ])
    .nodeId((node: SankeyNodeMinimal<object, object>) => (node as Node).id)

  sankeyGenerator.nodeAlign((node: SankeyNodeMinimal<object, object>) => {
    const { depthH } = node as Node
    return depthH ?? 0
  })

  const sankeyNodes = useMemo(() => {
    if (inputs.length === 0 || outputs.length === 0) return []

    const inputNodes = inputs.map((input, index) => ({
      id: String(index + 1),
      type: 'text',
      depthH: 0,
      textInfo: [
        input.valueIsKnown ? `${input.value}` : '',
        `${formatAddress(input.txid, 3)}`,
        input.label ?? ''
      ],
      value: input.value
    }))

    const blockNode = [
      {
        id: String(inputs.length + 1),
        type: 'block',
        depthH: 1,
        textInfo: ['', '', `${txSize} B`, `${txVsize} vB`],
        y0: 0
      }
    ]

    const outputNodes = outputs.map((output, index) => ({
      id: String(index + 2 + inputs.length),
      type: 'text',
      depthH: 2,
      textInfo: [
        `${output.value}`,
        `${formatAddress(output.address, 3)}`,
        output.label ?? ''
      ],
      value: output.value
    }))

    if (minerFee !== undefined) {
      outputNodes.push({
        id: String(inputs.length + outputs.length + 2),
        type: 'text',
        depthH: 2,
        textInfo: [`${minerFee}`, 'Miner fee', ''],
        value: minerFee
      })
    }

    return [...inputNodes, ...blockNode, ...outputNodes] as SankeyNodeMinimal<
      object,
      object
    >[]
  }, [inputs, outputs, txSize, txVsize, minerFee])

  const sankeyLinks = useMemo(() => {
    if (inputs.length === 0 || outputs.length === 0) return []

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

  const { nodes, links } = sankeyGenerator({
    nodes: sankeyNodes,
    links: sankeyLinks
  })

  const transformedLinks = links.map((link) => ({
    source: (link.source as Node).id,
    target: (link.target as Node).id,
    value: link.value
  }))

  if (transaction.vin.length === 0 || transaction.vout.length === 0) {
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

export default SSTransactionChart
