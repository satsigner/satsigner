import { useHeaderHeight } from '@react-navigation/elements'
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

import { useGestures } from '@/hooks/useGestures'
import { useInputTransactions } from '@/hooks/useInputTransactions'
import { useLayout } from '@/hooks/useLayout'
import { useNodesAndLinks } from '@/hooks/useNodesAndLinks'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { BLOCK_WIDTH, type Link, type Node } from '@/types/ui/sankey'

import SSSankeyLinks from './SSSankeyLinks'
import SSSankeyNodes from './SSSankeyNodes'

const LINK_MAX_WIDTH = 100
const NODE_WIDTH = 98

type SSMultipleSankeyDiagramProps = {
  onPressOutput?: (localId?: string) => void
  currentOutputLocalId?: string
  inputs: Map<string, Utxo>
  outputs: Output[]
  feeRate: number
}

function SSMultipleSankeyDiagram({
  onPressOutput,
  currentOutputLocalId,
  inputs,
  outputs,
  feeRate
}: SSMultipleSankeyDiagramProps) {
  const DEEP_LEVEL = 2 // how deep the tx history
  const { transactions } = useInputTransactions(inputs, DEEP_LEVEL)

  const { nodes: sankeyNodes, links: sankeyLinks } = useNodesAndLinks({
    transactions,
    inputs,
    outputs,
    feeRate
  })

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
    .nodePadding(120)
    .extent([
      [0, 200],
      [2000 * (maxDepthH / 10), 1000 * (maxNodeCountInDepthH / 9)]
    ])
    .nodeId((node: SankeyNodeMinimal<object, object>) => (node as Node).id)

  sankeyGenerator.nodeAlign((node: SankeyNodeMinimal<object, object>) => {
    const { depthH } = node as Node
    return depthH ?? 0
  })

  // Run sankey layout with fallback on error
  const { nodes, links } = useMemo(() => {
    try {
      const layout = sankeyGenerator({
        nodes: sankeyNodes,
        links: sankeyLinks as Link[]
      })
      return {
        nodes: layout.nodes as unknown as Node[],
        links: layout.links as unknown as Link[]
      }
    } catch {
      // If layout fails (e.g. invalid array), return empty nodes/links
      return { nodes: [], links: [] }
    }
  }, [sankeyGenerator, sankeyNodes, sankeyLinks])

  // Transform SankeyLinkMinimal to Link type
  const transformedLinks = links.map((link) => ({
    source: (link.source as unknown as Node).id,
    target: (link.target as unknown as Node).id,
    value: link.value
  }))

  // Calculate the optimal initial x translation to show the last 3 depthH levels
  const initialXTranslation = useMemo(() => {
    // If we have fewer than 3 depthH levels or no nodes, show from the beginning
    if (maxDepthH < 2 || !nodes?.length) {
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

    return Math.max(translation, -(diagramWidth - w / 2)) - 50
  }, [maxDepthH, nodes, w])

  const { animatedStyle, gestures, transform } = useGestures({
    width: w,
    height: h,
    center,
    isDoubleTapEnabled: true,
    maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
    minPanPointers: 1,
    maxScale: 20,
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

  // calculating the sankey node styles to match in skia
  const nodeStyles = useMemo(() => {
    return nodes.map((node) => {
      const isBlock = (node as Node).type === 'block'
      const blockNodeHeight =
        isBlock && (node as Node).ioData?.txSize
          ? ((node as Node).ioData?.txSize ?? 0) * 0.1
          : 0

      return {
        localId: (node as Node).localId,
        x: isBlock
          ? (node.x0 ?? 0) + (NODE_WIDTH - BLOCK_WIDTH) / 2
          : node.x0 ?? 0,
        y: node.y0 ?? 0,
        width: isBlock ? BLOCK_WIDTH : NODE_WIDTH,
        height: isBlock ? Math.max(blockNodeHeight, LINK_MAX_WIDTH) : 80
      }
    })
  }, [nodes])

  if (!nodes?.length || !transformedLinks?.length) {
    return null
  }

  return transactions.size > 0 &&
    nodes?.length > 0 &&
    links?.length > 0 &&
    transformedLinks?.length > 0 ? (
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
          <SSSankeyNodes
            nodes={nodes}
            sankeyGenerator={sankeyGenerator}
            selectedOutputNode={currentOutputLocalId}
          />
          {nodes.map((node, index) => {
            const typedNode = node as Node
            const style = nodeStyles[index] // Get corresponding style for width/height

            if (typedNode.depthH === maxDepthH) {
              const cy = style.y + 6.5 // 5px top padding + 1.5px circle center offset

              const circle1Cx = style.x + style.width - 31 // style.x + style.width - 16 (right padding + icon width) + 1.48926 (circle cx in icon)
              const circle2Cx = style.x + style.width - 35 // style.x + style.width - 16 + 5.48926
              const circle3Cx = style.x + style.width - 39 // style.x + style.width - 16 + 9.48926

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
  ) : null
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
  },
  iconContainer: {
    position: 'absolute',
    top: 5,
    right: 5,
    padding: 5
  }
})

export default SSMultipleSankeyDiagram
