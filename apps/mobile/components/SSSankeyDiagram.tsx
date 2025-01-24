import {
  Canvas,
  Group,
  Path,
  Rect,
  Skia,
  TileMode,
  vec
} from '@shopify/react-native-skia'
import type { SankeyLinkMinimal, SankeyNodeMinimal } from 'd3-sankey'
import { sankey } from 'd3-sankey'
import React, { useCallback } from 'react'
import { Platform, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import { useGestures } from '@/hooks/useGestures'
import { useLayout } from '@/hooks/useLayout'
import { gray } from '@/styles/colors'

import { SSSankeyNode } from './SSSankeyNode'

interface Link extends SankeyLinkMinimal<object, object> {
  source: string
  target: string
  value: number
}

interface Node extends SankeyNodeMinimal<object, object> {
  id: string
  depthH: number
  type?: string
  textInfo: string[]
  value?: number
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
const VERTICAL_OFFSET_NODE = 22
const BLOCK_WIDTH = 50

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
    shouldResetOnInteractionEnd: false
  })

  const sankeyGenerator = sankey()
    .nodeWidth(78)
    .nodePadding(100)
    .extent([
      [0, 160],
      [1000 * 0.7, 1000 * ((inputCount * 2) / 10)]
    ])
    .nodeId((node: SankeyNodeMinimal<object, object>) => (node as Node).id)

  sankeyGenerator.nodeAlign((node: SankeyNodeMinimal<object, object>) => {
    const { depthH } = node as Node
    return depthH - 1
  })
  console.log('hey sankey diagram', Math.max(2.4, inputCount) / 10)

  const { nodes, links } = sankeyGenerator({
    nodes: sankeyNodes,
    links: sankeyLinks.map((item) => ({
      source: item.source,
      target: item.target,
      value: item.value
    }))
  })
  console.log('sankey diagram', {
    sankeyNodes,
    sankeyLinks
  })

  const getLinkWidth = useCallback(
    (node: Node, maxWidth: number) => {
      // For block nodes, return a fixed small width
      if (node.type === 'block') {
        return Math.min(2, maxWidth)
      }

      // Find links where this node is the target (incoming) or source (outgoing)
      const incomingLinks = links.filter((link) => {
        const targetNode = link.target as Node
        return targetNode.id === node.id
      })

      const outgoingLinks = links.filter((link) => {
        const sourceNode = link.source as Node
        return sourceNode.id === node.id
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
        (link) => (link.source as Node).id === node.id
      )
      const totalSats = isSource ? totalOutgoingSats : totalIncomingSats

      // Calculate width (max width proportional to sats percentage)
      return (nodeSats / totalSats) * maxWidth
    },
    [links]
  )

  if (!nodes?.length || !links?.length) {
    return null
  }

  return (
    <View style={{ flex: 1 }}>
      <Canvas style={{ width: 2000, height: 2000 }} onLayout={onCanvasLayout}>
        <Group transform={transform} origin={{ x: w / 2, y: h / 2 }}>
          {links.map((link, index) => {
            const sourceNode = link.source as Node
            const targetNode = link.target as Node
            const isUnspent = targetNode.textInfo[0] === 'Unspent'

            const points: LinkPoints = {
              souceWidth:
                sourceNode.type === 'block'
                  ? Math.min(2, getLinkWidth(targetNode, LINK_MAX_WIDTH))
                  : getLinkWidth(sourceNode, LINK_MAX_WIDTH),
              targetWidth:
                targetNode.type === 'block'
                  ? Math.min(2, getLinkWidth(targetNode, LINK_MAX_WIDTH))
                  : getLinkWidth(targetNode, LINK_MAX_WIDTH),
              x1:
                sourceNode.type === 'block'
                  ? (sourceNode.x1 ?? 0) -
                    (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
                  : sourceNode.x1 ?? 0,
              y1: (link.source as Node).y1 ?? 0,
              x2:
                targetNode.type === 'block'
                  ? (targetNode.x0 ?? 0) +
                    (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
                  : targetNode.x0 ?? 0,
              y2: (link.target as Node).y0 ?? 0
            }
            const path1 = generateCustomLink(points)

            return (
              <Group key={index}>
                <Path
                  key={index}
                  path={path1}
                  style="fill"
                  color={gray[700]}
                  // Create a paint object for the gradient
                  paint={
                    isUnspent
                      ? (() => {
                          const paint = Skia.Paint()
                          paint.setShader(
                            Skia.Shader.MakeLinearGradient(
                              vec(points.x1, points.y1),
                              vec(points.x2, points.y2),
                              [Skia.Color(gray[700]), Skia.Color('#fdfdfd')],
                              [0, 0.9],
                              TileMode.Clamp
                            )
                          )
                          return paint
                        })()
                      : undefined
                  }
                />
              </Group>
            )
          })}

          {nodes.map((node, index) => {
            const dataNode = node as Node

            const blockRect = () => {
              if (dataNode.type === 'block') {
                // Extract size from textInfo[2] which is in format "X B"
                const sizeStr = dataNode.textInfo[2]
                const size = parseInt(sizeStr.split(' ')[0], 10)
                // Scale the height based on size, max height is 100
                const height = Math.min(100, Math.max(40, (size / 2000) * 100))

                return (
                  <Group>
                    <Rect
                      x={
                        (node.x0 ?? 0) + (sankeyGenerator.nodeWidth() - 50) / 2
                      }
                      y={(node.y0 ?? 0) - 0.5 * VERTICAL_OFFSET_NODE}
                      width={BLOCK_WIDTH}
                      height={height}
                      color="#FFFFFF"
                    />
                  </Group>
                )
              }
              return null
            }
            return (
              <Group key={index}>
                <SSSankeyNode
                  width={sankeyGenerator.nodeWidth()}
                  x={node.x0 ?? 0}
                  y={(node.y0 ?? 0) - 1.6 * VERTICAL_OFFSET_NODE}
                  textInfo={dataNode.textInfo}
                />
                {blockRect()}
              </Group>
            )
          })}
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
