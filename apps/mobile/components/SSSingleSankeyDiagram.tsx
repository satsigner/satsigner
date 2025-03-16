import { useHeaderHeight } from '@react-navigation/elements'
import { Canvas, Group } from '@shopify/react-native-skia'
import {
  sankey,
  type SankeyLinkMinimal,
  type SankeyNodeMinimal
} from 'd3-sankey'
import { useMemo } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { useLayout } from '@/hooks/useLayout'
import { formatAddress } from '@/utils/format'

import { SSSankeyLinks } from './SSSankeyLinks'
import { SSSankeyNodes } from './SSSankeyNodes'

export interface Link extends SankeyLinkMinimal<object, object> {
  source: string
  target: string
  value: number
}

export interface Node extends SankeyNodeMinimal<object, object> {
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

type SSSingleSankeyDiagramProps = {
  inputs: { value: number; txid: string; label?: string }[]
  outputs: { value: number; address: string; label?: string }[]
  size: number
}

function SSSingleSankeyDiagram({
  inputs,
  outputs,
  size
}: SSSingleSankeyDiagramProps) {
  const { width: w, height: h, onCanvasLayout } = useLayout()
  const topHeaderHeight = useHeaderHeight()
  const { width, height } = useWindowDimensions()
  const GRAPH_HEIGHT = height - topHeaderHeight
  const GRAPH_WIDTH = width

  // Calculate the maximum number of nodes at any depthH level
  const sankeyGenerator = sankey()
    .nodeWidth(NODE_WIDTH)
    .nodePadding(100)
    .extent([
      [-8, 0],
      [w, 1000 * size * 0.0005]
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
        `${input.value}`,
        `${formatAddress(input.txid, 3)}`,
        input.label ?? ''
      ],
      value: input.value,
      index: 0
    }))

    const blockNode = [
      {
        id: String(inputs.length + 1),
        type: 'block',
        depthH: 1,
        textInfo: ['', '', '1533 B', '1509 vB'],
        index: 0
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
      value: output.value,
      index: 0
    }))

    return [...inputNodes, ...blockNode, ...outputNodes] as SankeyNodeMinimal<
      object,
      object
    >[]
  }, [inputs, outputs])

  const sankeyLinks = useMemo(() => {
    if (inputs.length === 0 || outputs.length === 0) return []

    const inputToBlockLinks = inputs.map((input, index) => ({
      source: String(index + 1),
      target: String(inputs.length + 1),
      value: input.value
    }))

    const blockToOutputLinks = outputs.map((output, index) => ({
      source: String(inputs.length + 1),
      target: String(index + inputs.length + 2),
      value: output.value
    }))

    return [...inputToBlockLinks, ...blockToOutputLinks]
  }, [inputs, outputs])

  const { nodes, links } = sankeyGenerator({
    nodes: sankeyNodes,
    links: sankeyLinks
  })

  // Transform SankeyLinkMinimal to Link type
  const transformedLinks = links.map((link) => ({
    source: (link.source as Node).id,
    target: (link.target as Node).id,
    value: link.value
  }))

  if (!nodes?.length || !transformedLinks?.length) {
    return null
  }

  return (
    <View style={{ flex: 1 }}>
      <Canvas
        style={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
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

export default SSSingleSankeyDiagram
