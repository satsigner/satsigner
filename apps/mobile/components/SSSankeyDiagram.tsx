import { Canvas, Group } from '@shopify/react-native-skia'
import type { SankeyLinkMinimal, SankeyNodeMinimal } from 'd3-sankey'
import { sankey } from 'd3-sankey'
import { useCallback } from 'react'
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

interface LinkPoints {
  souceWidth: number
  targetWidth: number
  x1: number
  y1: number
  x2: number
  y2: number
}

interface SankeyProps {
  sankeyNodes: Node[]
  sankeyLinks: Link[]
  inputCount: number
}

const LINK_MAX_WIDTH = 60
const BLOCK_WIDTH = 50
const NODE_WIDTH = 98

const generateCustomLink = (points: LinkPoints) => {
  const { x1, y1, x2, y2, souceWidth, targetWidth } = points

  const adjustedY1 = y1
  const adjustedY2 = y2

  // Define the coordinates of the four points
  const A = [x1, adjustedY1 - souceWidth / 2] // Point A (adjusted)
  const B = [x1, adjustedY1 + souceWidth / 2] // Point B (adjusted)
  const C = [x2, adjustedY2 - targetWidth / 2] // Point C (adjusted)
  const D = [x2, adjustedY2 + targetWidth / 2] // Point D (adjusted)

  // Solid line path
  const moveToA = `M ${A[0]} ${A[1]}`
  const lineToB = `L ${B[0]} ${B[1]}`

  let curveToCenterD = `C ${B[0]} ${B[1]}`
  curveToCenterD += ` ${B[0] + (D[0] - B[0]) / 3} ${B[1]}`
  curveToCenterD += ` ${B[0] + (D[0] - B[0]) / 2} ${B[1] + (D[1] - B[1]) / 2}`

  let curveToD = `C ${B[0] + (D[0] - B[0]) / 2} ${B[1] + (D[1] - B[1]) / 2}`
  curveToD += ` ${B[0] + ((D[0] - B[0]) / 3) * 2} ${D[1]}`
  curveToD += ` ${D[0]} ${D[1]}`

  const lineToC = `L ${C[0]} ${C[1]}`

  let curveToCenterA = `C ${C[0]} ${C[1]}`
  curveToCenterA += ` ${C[0] + (A[0] - C[0]) / 3} ${C[1]}`
  curveToCenterA += ` ${C[0] + (A[0] - C[0]) / 2} ${C[1] + (A[1] - C[1]) / 2}`

  let curveToA = `C ${C[0] + (A[0] - C[0]) / 2} ${C[1] + (A[1] - C[1]) / 2}`
  curveToA += ` ${C[0] + ((A[0] - C[0]) / 3) * 2} ${A[1]}`
  curveToA += ` ${A[0]} ${A[1]}`
  return [
    moveToA,
    lineToB,
    curveToCenterD,
    curveToD,
    lineToC,
    curveToCenterA,
    curveToA,
    'Z'
  ].join('\n')
}

function SSSankeyDiagram({
  sankeyNodes,
  sankeyLinks,
  inputCount
}: SankeyProps) {
  const { width: w, height: h, center, onCanvasLayout } = useLayout()
  const { animatedStyle, gestures, transform } = useGestures({
    width: w,
    height: h,
    center,
    isDoubleTapEnabled: true,
    maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
    minPanPointers: 1,
    maxScale: 10,
    minScale: 0.5,
    shouldResetOnInteractionEnd: false,
    initialTranslation: {
      x: -980,
      y: 0
    }
  })

  const sankeyGenerator = sankey()
    .nodeWidth(NODE_WIDTH)
    .nodePadding(120)
    .extent([
      [0, 160],
      [2000 * 0.7, 1000 * (Math.max(inputCount * 2, 2.6) / 10)]
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

  const getLinkWidth = useCallback(
    (node: Node, maxWidth: number) => {
      // For block nodes, return a fixed small width
      if (node.type === 'block') {
        return Math.min(2, maxWidth)
      }

      // Find links where this node is the target (incoming) or source (outgoing)
      const incomingLinks = transformedLinks.filter((link) => {
        const targetNode = link.target
        return targetNode === node.id
      })

      const outgoingLinks = transformedLinks.filter((link) => {
        const sourceNode = link.source
        return sourceNode === node.id
      })

      // Calculate total sats for incoming and outgoing links separately
      const totalIncomingSats = incomingLinks.reduce(
        (sum, link) => sum + (link.value ?? 0),
        0
      )
      const totalOutgoingSats = outgoingLinks.reduce(
        (sum, link) => sum + (link.value ?? 0),
        0
      )

      // Get current node's sats
      const nodeSats = node?.value ?? 0

      // Calculate width based on whether this node is source or target in the current context
      const isSource = outgoingLinks.some(
        (link) => (link.source as string) === node.id
      )
      const totalSats = isSource ? totalOutgoingSats : totalIncomingSats

      // Calculate width (max width proportional to sats percentage)
      return (nodeSats / totalSats) * maxWidth
    },
    [transformedLinks]
  )

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
            getLinkWidth={getLinkWidth}
            generateCustomLink={generateCustomLink}
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
