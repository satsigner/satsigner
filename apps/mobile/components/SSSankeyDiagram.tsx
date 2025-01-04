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

import { gray } from '@/styles/colors'

import { SSSankeyNode } from './SSSankeyNode'

interface Link extends SankeyLinkMinimal<object, object> {
  source: string
  target: string
  value: number
}

interface Node extends SankeyNodeMinimal<object, object> {
  indexC: number
  id: string
  depthH: number
  type?: string
  textInfo: string[]
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
const generateCustomLink = (points: LinkPoints) => {
  const { x1, y1, x2, y2, souceWidth, targetWidth } = points

  // Define the coordinates of the four points
  const A = [x1, y1 - souceWidth / 2] // Point A
  const B = [x1, y1 + souceWidth / 2] // Point B
  const C = [x2, y2 - targetWidth / 2] // Point C
  const D = [x2, y2 + targetWidth / 2] // Point D

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
  const sankeyGenerator = sankey()
    .nodeWidth(78)
    .nodePadding(100)
    .extent([
      [20, 160],
      [1000 * 0.4, 1000 * (Math.max(2.4, inputCount) / 10)]
    ])
    .nodeId((node: SankeyNodeMinimal<object, object>) => (node as Node).id)

  sankeyGenerator.nodeAlign((node: SankeyNodeMinimal<object, object>) => {
    const { depthH } = node as Node
    return depthH - 1
  })

  const { nodes, links } = sankeyGenerator({
    nodes: sankeyNodes,
    links: sankeyLinks.map((item) => ({
      source: item.source,
      target: item.target,
      value: item.value
    }))
  })

  const getLinkWidth = useCallback(
    (node: Node, maxWidth: number) => {
      // Find all nodes at the same depth as the target node
      const nodesAtSameDepth = nodes.filter((n) => n.depth === node.depth)

      // Calculate total sats at this depth
      const totalSats = nodesAtSameDepth.reduce((sum, n) => {
        const sats = n?.value ?? 0
        return sum + sats
      }, 0)

      // Get current node's sats
      const nodeSats = node?.value ?? 0

      // Calculate width (max width proportional to sats percentage)
      return (nodeSats / totalSats) * maxWidth
    },
    [nodes]
  )

  if (!nodes || !links) {
    return null
  }

  return (
    <Canvas
      style={{
        width: 2000,
        height: 2000
      }}
    >
      <Group>
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
                ? (sourceNode.x1 ?? 0) - (sankeyGenerator.nodeWidth() - 50) / 2
                : sourceNode.x1 ?? 0,
            y1: (link.source as Node).y1 ?? 0,
            x2:
              targetNode.type === 'block'
                ? (targetNode.x0 ?? 0) + (sankeyGenerator.nodeWidth() - 50) / 2
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

        {/* Draw nodes */}
        {nodes.map((node, index) => {
          const dataNode = node as Node

          const blockRect = () => {
            if (dataNode.type === 'block') {
              return (
                <Group>
                  <Rect
                    x={(node.x0 ?? 0) + (sankeyGenerator.nodeWidth() - 50) / 2}
                    y={(node.y0 ?? 0) - 0.5 * VERTICAL_OFFSET_NODE}
                    width={50}
                    //TODO: to be calculated
                    height={100}
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
  )
}

export default SSSankeyDiagram
