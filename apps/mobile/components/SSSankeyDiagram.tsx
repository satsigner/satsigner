import { Canvas, Group } from '@shopify/react-native-skia'
import {
  sankey,
  type SankeyLinkMinimal,
  type SankeyNodeMinimal
} from 'd3-sankey'
import { useMemo } from 'react'
import { Platform, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import { useGestures } from '@/hooks/useGestures'
import { useLayout } from '@/hooks/useLayout'

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

type SSSankeyDiagramProps = {
  sankeyNodes: Node[]
  sankeyLinks: Link[]
}

function SSSankeyDiagram({ sankeyNodes, sankeyLinks }: SSSankeyDiagramProps) {
  const { width: w, height: h, center, onCanvasLayout } = useLayout()
  const { animatedStyle, gestures, transform } = useGestures({
    width: w,
    height: h,
    center,
    isDoubleTapEnabled: true,
    maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
    minPanPointers: 1,
    maxScale: 10,
    minScale: 0.2,
    shouldResetOnInteractionEnd: false,
    initialTranslation: {
      x: -980,
      y: 0
    }
  })

  // Calculate the maximum number of nodes at any depthH level
  const maxNodeCountInDepthH = useMemo(() => {
    const depthCounts = new Map<number, number>()

    sankeyNodes.forEach((node) => {
      const count = depthCounts.get(node.depthH) || 0
      depthCounts.set(node.depthH, count + 1)
    })

    return depthCounts.size > 0
      ? Math.max(...Array.from(depthCounts.values()))
      : 0
  }, [sankeyNodes])

  const sankeyGenerator = sankey()
    .nodeWidth(NODE_WIDTH)
    .nodePadding(120)
    .extent([
      [0, 160],
      [2000 * 0.7, 1000 * (maxNodeCountInDepthH / 10)]
    ])
    .nodeId((node: SankeyNodeMinimal<object, object>) => (node as Node).id)

  sankeyGenerator.nodeAlign((node: SankeyNodeMinimal<object, object>) => {
    const { depthH } = node as Node
    return depthH ?? 0
  })

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
        <Group transform={transform} origin={{ x: w / 2, y: h / 2 }}>
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
      <GestureDetector gesture={gestures}>
        <View
          style={{
            flex: 1,
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
          }}
        >
          <Animated.View
            style={[{ width: 2000, height: 2000 }, animatedStyle]}
            onLayout={onCanvasLayout}
          />
        </View>
      </GestureDetector>
    </View>
  )
}

export default SSSankeyDiagram
