import { Canvas, Group } from '@shopify/react-native-skia'
import {
  sankey,
  type SankeyLinkMinimal,
  type SankeyNodeMinimal
} from 'd3-sankey'
import { useMemo } from 'react'
import { View } from 'react-native'

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
  // sankeyNodes: Node[]
  // sankeyLinks: Link[]
  utxosSelectedValue: number
  inputs: Map<string, { value: number; txid: string; label?: string }>
}

function SSSingleSankeyDiagram({
  // sankeyNodes,
  // sankeyLinks
  utxosSelectedValue,
  inputs
}: SSSingleSankeyDiagramProps) {
  const { width: w, height: h, onCanvasLayout } = useLayout()

  // Calculate the maximum number of nodes at any depthH level
  const MINING_FEE_VALUE = 1635
  const sankeyGenerator = sankey()
    .nodeWidth(NODE_WIDTH)
    .nodePadding(100)
    .extent([
      [0, 160],
      [1000 * 0.4, 1000 * (Math.max(2.4, inputs.size) / 10)]
    ])
    .nodeId((node: SankeyNodeMinimal<object, object>) => (node as Node).id)

  sankeyGenerator.nodeAlign((node: SankeyNodeMinimal<object, object>) => {
    const { depthH } = node as Node
    return depthH ?? 0
  })

  const sankeyNodes = useMemo(() => {
    if (inputs.size > 0) {
      const inputNodes = Array.from(
        inputs.entries() as Iterable<
          [string, { value: number; txid: string; label?: string }]
        >
      ).map(([, input], index) => ({
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
          id: String(inputs.size + 1),
          type: 'block',
          depthH: 1,
          textInfo: ['', '', '1533 B', '1509 vB'],
          index: 0
        }
      ]

      const miningFee = `${MINING_FEE_VALUE}`
      const priority = '42 sats/vB'
      const outputNodes = [
        {
          id: String(inputs.size + 2),
          type: 'text',
          depthH: 2,
          textInfo: [
            'Unspent',
            `${utxosSelectedValue - MINING_FEE_VALUE}`,
            'to'
          ],
          value: utxosSelectedValue - MINING_FEE_VALUE,
          index: 0
        },
        {
          id: String(inputs.size + 3),
          indexC: inputs.size + 3,
          type: 'text',
          depthH: 3,
          textInfo: [priority, miningFee, 'mining fee'],
          value: MINING_FEE_VALUE,
          index: 0
        }
      ]
      return [...inputNodes, ...blockNode, ...outputNodes] as SankeyNodeMinimal<
        object,
        object
      >[]
    } else {
      return []
    }
  }, [inputs, utxosSelectedValue])

  const sankeyLinks = useMemo(() => {
    if (inputs.size === 0) return []

    const inputToBlockLinks = Array.from(
      inputs.entries() as Iterable<
        [string, { value: number; txid: string; label?: string }]
      >
    ).map(([, input], index) => ({
      source: String(index + 1),
      target: String(inputs.size + 1),
      value: input.value
    }))

    const blockToOutputLinks = [
      {
        source: String(inputs.size + 1),
        target: String(inputs.size + 2),
        value: utxosSelectedValue - MINING_FEE_VALUE
      },
      {
        source: String(inputs.size + 1),
        target: String(inputs.size + 3),
        value: MINING_FEE_VALUE
      }
    ]

    return [...inputToBlockLinks, ...blockToOutputLinks]
  }, [inputs, utxosSelectedValue])

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
      <Canvas style={{ width: 2000, height: 2000 }} onLayout={onCanvasLayout}>
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
