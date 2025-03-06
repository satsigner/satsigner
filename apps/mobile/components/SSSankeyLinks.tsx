import {
  Group,
  LinearGradient,
  Paint,
  Path,
  vec
} from '@shopify/react-native-skia'
import { useCallback } from 'react'

import { gray } from '@/styles/colors'

interface Node {
  id: string
  depthH: number
  type: string
  textInfo: string[]
  x0?: number
  x1?: number
  y0?: number
  y1?: number
  depth?: number
  address?: string
  value?: number
  txId?: string
  nextTx?: string
}

interface Link {
  source: string
  target: string
  value: number
}

interface LinkPoints {
  souceWidth: number
  targetWidth: number
  x1: number
  y1: number
  x2: number
  y2: number
}

interface SSSankeyLinksProps {
  links: Link[]
  nodes: Node[]
  sankeyGenerator: any
  LINK_MAX_WIDTH: number
  BLOCK_WIDTH: number
}

const LINK_BLOCK_MAX_WIDTH = 16

export function SSSankeyLinks({
  links,
  nodes,
  sankeyGenerator,
  LINK_MAX_WIDTH,
  BLOCK_WIDTH
}: SSSankeyLinksProps) {
  const getLinkWidth = useCallback(
    (sourceNode: Node, targetNode: Node, type: string) => {
      // Helper function to get total incoming value for a block node
      const getTotalIncomingValueForBlock = (blockNode: Node) => {
        return links
          .filter((link) => {
            const targetNode = nodes.find((n) => n.id === link.target)
            return targetNode?.id === blockNode.id
          })
          .reduce((sum, link) => sum + (link.value ?? 0), 0)
      }

      // Helper function to get total outgoing value from a block node
      const getTotalOutgoingValueFromBlock = (blockNode: Node) => {
        return links
          .filter((link) => {
            const sourceNode = nodes.find((n) => n.id === link.source)
            return sourceNode?.id === blockNode.id
          })
          .reduce((sum, link) => sum + (link.value ?? 0), 0)
      }
      const node = type === 'source' ? sourceNode : targetNode

      if (node.type === 'block' && type === 'source') {
        // For incoming connections to block, get value from the source node
        const targetNodeSats = targetNode.value ?? 0

        const totalOutgoing = getTotalOutgoingValueFromBlock(node)

        return (targetNodeSats / totalOutgoing) * LINK_BLOCK_MAX_WIDTH
        // return (targetNodeSats / totalOutgoing) * LINK_BLOCK_MAX_WIDTH
      } else if (node.type === 'block' && type === 'target') {
        const sourceNodeSats = sourceNode.value ?? 0

        const totalIncoming = getTotalIncomingValueForBlock(node)

        return (sourceNodeSats / totalIncoming) * LINK_BLOCK_MAX_WIDTH
      }

      // Get current node's sats
      const nodeSats = node?.value ?? 0

      // Determine if this node connects to a block node
      const connectedBlockNode = nodes.find((n) => {
        if (n.type !== 'block') return false

        // Check if this node is connected to the block node
        return links.some(
          (link) =>
            (link.source === node.id && link.target === n.id) ||
            (link.source === n.id && link.target === node.id)
        )
      })

      // Calculate width based on whether this node is sending to or receiving from the block
      const isSourceToBlock = links.some(
        (link) =>
          link.source === node.id && link.target === connectedBlockNode?.id
      )

      let calculatedWidth
      if (isSourceToBlock) {
        // Node is sending to block - use total incoming value of block
        const totalIncoming = connectedBlockNode
          ? getTotalIncomingValueForBlock(connectedBlockNode)
          : LINK_MAX_WIDTH
        calculatedWidth = (nodeSats / totalIncoming) * LINK_MAX_WIDTH
      } else {
        // Node is receiving from block - use total outgoing value from block
        const totalOutgoing = connectedBlockNode
          ? getTotalOutgoingValueFromBlock(connectedBlockNode)
          : LINK_MAX_WIDTH
        calculatedWidth = (nodeSats / totalOutgoing) * LINK_MAX_WIDTH
      }

      return calculatedWidth
    },
    [links, nodes, LINK_MAX_WIDTH]
  )

  if (links.length === 0) return null

  return (
    <>
      {links.map((link, index) => {
        const sourceNode = nodes.find((n) => n.id === link.source) as Node
        const targetNode = nodes.find((n) => n.id === link.target) as Node
        const isUnspent = targetNode.textInfo[0] === 'Unspent'

        const points: LinkPoints = {
          souceWidth: getLinkWidth(sourceNode, targetNode, 'source'),
          targetWidth: getLinkWidth(sourceNode, targetNode, 'target'),
          x1:
            sourceNode.type === 'block'
              ? (sourceNode.x1 ?? 0) -
                (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
              : sourceNode.x1 ?? 0,
          y1: sourceNode.y1 ?? 0,
          x2:
            targetNode.type === 'block'
              ? (targetNode.x0 ?? 0) +
                (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
              : targetNode.x0 ?? 0,
          y2: targetNode.y0 ?? 0
        }
        const path1 = generateCustomLink(points)

        return (
          <Group key={index}>
            <Path
              key={index}
              path={path1}
              style="fill"
              color={gray[700]}
              opacity={0.4}
            >
              {isUnspent && (
                <>
                  {/* Base layer - dark gray */}
                  <Paint>
                    <LinearGradient
                      start={vec(points.x1, points.y1)}
                      end={vec(points.x2, points.y2)}
                      colors={['#363636', '#363636']}
                      positions={[0, 1]}
                    />
                  </Paint>

                  {/* White to gray gradient */}
                  <Paint>
                    <LinearGradient
                      start={vec(points.x2, points.y1)}
                      end={vec(
                        points.x1 + (points.x2 - points.x1) * 0.58,
                        points.y1
                      )}
                      colors={['#FFFFFF', '#5B5B5B']}
                      positions={[0, 1]}
                    />
                  </Paint>

                  {/* Another dark gray layer */}
                  <Paint>
                    <LinearGradient
                      start={vec(points.x1, points.y1)}
                      end={vec(points.x2, points.y2)}
                      colors={['#363636', '#363636']}
                      positions={[0, 1]}
                    />
                  </Paint>

                  {/* White overlay */}
                  <Paint opacity={0.7}>
                    <LinearGradient
                      start={vec(points.x1, points.y1)}
                      end={vec(points.x2, points.y2)}
                      colors={['#FFFFFF', '#FFFFFF']}
                      positions={[0, 1]}
                    />
                  </Paint>

                  {/* Final gradient - dark to white */}
                  <Paint>
                    <LinearGradient
                      start={vec(
                        points.x2 + (points.x2 - points.x1) * 0.03,
                        points.y1
                      )}
                      end={vec(
                        points.x1 + (points.x2 - points.x1) * 0.7,
                        points.y1
                      )}
                      colors={['#2C2C2C', '#FFFFFF']}
                      positions={[0, 1]}
                    />
                  </Paint>
                </>
              )}
            </Path>
          </Group>
        )
      })}
    </>
  )
}

const generateCustomLink = (points: LinkPoints) => {
  const { x1, y1, x2, y2, souceWidth, targetWidth } = points

  // Define the coordinates of the four points
  const A = [x1, y1 - souceWidth / 2] // Point A
  const B = [x1, y1 + souceWidth / 2] // Point B
  const C = [x2, y2 - targetWidth / 2] // Point C
  const D = [x2, y2 + targetWidth / 2] // Point D

  // Curve control point percentages - adjust these to experiment with curve shapes
  const firstCurveFirstControlX = 0 // 0 means same as source point
  const firstCurveSecondControlX = 0.3 // 1/3 of the way from source to target
  const midpointX = 1 / 2 // Halfway between source and target
  const midpointY = 1 / 2 // Halfway between source and target heights
  const secondCurveSecondControlX = 0.7 // 2/3 of the way from source to target

  // Solid line path
  const moveToA = `M ${A[0]} ${A[1]}`
  const lineToB = `L ${B[0]} ${B[1]}`

  let curveToCenterD = `C ${B[0] + (D[0] - B[0]) * firstCurveFirstControlX} ${B[1]}`
  curveToCenterD += ` ${B[0] + (D[0] - B[0]) * firstCurveSecondControlX} ${B[1]}`
  curveToCenterD += ` ${B[0] + (D[0] - B[0]) * midpointX} ${B[1] + (D[1] - B[1]) * midpointY}`

  let curveToD = `C ${B[0] + (D[0] - B[0]) * midpointX} ${B[1] + (D[1] - B[1]) * midpointY}`
  curveToD += ` ${B[0] + (D[0] - B[0]) * secondCurveSecondControlX} ${D[1]}`
  curveToD += ` ${D[0]} ${D[1]}`

  const lineToC = `L ${C[0]} ${C[1]}`

  let curveToCenterA = `C ${C[0] + (A[0] - C[0]) * firstCurveFirstControlX} ${C[1]}`
  curveToCenterA += ` ${C[0] + (A[0] - C[0]) * firstCurveSecondControlX} ${C[1]}`
  curveToCenterA += ` ${C[0] + (A[0] - C[0]) * midpointX} ${C[1] + (A[1] - C[1]) * midpointY}`

  let curveToA = `C ${C[0] + (A[0] - C[0]) * midpointX} ${C[1] + (A[1] - C[1]) * midpointY}`
  curveToA += ` ${C[0] + (A[0] - C[0]) * secondCurveSecondControlX} ${A[1]}`
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
