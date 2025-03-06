import { useHeaderHeight } from '@react-navigation/elements'
import { Canvas, Group } from '@shopify/react-native-skia'
import {
  sankey,
  type SankeyLinkMinimal,
  type SankeyNodeMinimal
} from 'd3-sankey'
import { useMemo } from 'react'
import { Platform, useWindowDimensions, View } from 'react-native'
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

const LINK_MAX_WIDTH = 100
const BLOCK_WIDTH = 50
const NODE_WIDTH = 98

type SSMultipleSankeyDiagramProps = {
  sankeyNodes: Node[]
  sankeyLinks: Link[]
}

function SSMultipleSankeyDiagram({
  sankeyNodes,
  sankeyLinks
}: SSMultipleSankeyDiagramProps) {
  const { width: w, height: h, center, onCanvasLayout } = useLayout()

  // Calculate the maximum depthH value across all nodes
  const maxDepthH = useMemo(() => {
    return sankeyNodes.reduce((max, node) => {
      return Math.max(max, node.depthH)
    }, 0)
  }, [sankeyNodes])

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
    .nodePadding(140)
    .extent([
      [0, 160],
      [2000 * (maxDepthH / 11), 1000 * (maxNodeCountInDepthH / 9)]
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

  // Calculate the optimal initial x translation to show the last 3 depthH levels
  const initialXTranslation = useMemo(() => {
    // If we have fewer than 3 depthH levels or no nodes, show from the beginning
    if (maxDepthH < 2 || !nodes.length) {
      return 0
    }

    // Find the x position of nodes in the last 3 depthH levels
    const lastThreeLevels = [maxDepthH, maxDepthH - 1, maxDepthH - 2].filter(
      (level) => level >= 0
    )

    // Find the minimum and maximum x positions among nodes in the last three levels
    let minX = Infinity
    let maxX = -Infinity

    nodes.forEach((node) => {
      const typedNode = node as Node
      if (
        lastThreeLevels.includes(typedNode.depthH) &&
        typeof typedNode.x0 === 'number'
      ) {
        minX = Math.min(minX, typedNode.x0)
        maxX = Math.max(maxX, typedNode.x0)
      }
    })

    // Calculate the width of the last three levels
    const lastThreeLevelsWidth = maxX - minX + NODE_WIDTH

    // If the width of the last three levels is less than the viewport width,
    // center them in the viewport
    if (lastThreeLevelsWidth < w) {
      return -(minX - (w - lastThreeLevelsWidth) / 2)
    }

    // Otherwise, show from the minimum x position with a small offset
    const translation = -(minX - w / 10)

    // Calculate the total diagram width (approximation)
    const diagramWidth = 2000 * (maxDepthH / 11)

    // Ensure the translation doesn't move the diagram too far off-screen
    // This prevents extreme translations that might make the diagram invisible

    return Math.max(translation, -(diagramWidth - w / 2))
  }, [maxDepthH, nodes, w])

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
      x: initialXTranslation,
      y: 0
    }
  })
  const topHeaderHeight = useHeaderHeight()
  const { width, height } = useWindowDimensions()
  const GRAPH_HEIGHT = height - topHeaderHeight
  const GRAPH_WIDTH = width

  if (!nodes?.length || !transformedLinks?.length) {
    return null
  }
  return (
    <View style={{ flex: 1 }}>
      <Canvas
        style={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
        onLayout={onCanvasLayout}
      >
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
            left: 0,
            borderColor: 'red',
            borderWidth: 2
          }}
        >
          <Animated.View
            style={[
              { width: GRAPH_WIDTH, height: GRAPH_HEIGHT },
              animatedStyle
            ]}
            onLayout={onCanvasLayout}
          />
        </View>
      </GestureDetector>
    </View>
  )
}

export default SSMultipleSankeyDiagram
