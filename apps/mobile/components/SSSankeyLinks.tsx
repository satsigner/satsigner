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
  localId?: string
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

export const LINK_BLOCK_MAX_WIDTH = 16

function SSSankeyLinks({
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

  // Add new helper functions to track cumulative heights
  const getStackedYPosition = useCallback(
    (node: Node, isSource: boolean, currentLink: Link) => {
      let cumulativeHeight = 0

      // Sort links by their target/source y-position
      const relevantLinks = links
        .filter((link) => {
          if (isSource) {
            return link.source === node.id
          } else {
            return link.target === node.id
          }
        })
        .sort((a, b) => {
          const aNode = isSource
            ? nodes.find((n) => n.id === a.target)
            : nodes.find((n) => n.id === a.source)
          const bNode = isSource
            ? nodes.find((n) => n.id === b.target)
            : nodes.find((n) => n.id === b.source)

          // Sort by y0 for incoming links, y1 for outgoing links
          const aY = isSource ? aNode?.y0 ?? 0 : aNode?.y1 ?? 0
          const bY = isSource ? bNode?.y0 ?? 0 : bNode?.y1 ?? 0

          return aY - bY // Sort from top to bottom
        })

      // Find index of current link in sorted links
      const currentLinkIndex = relevantLinks.findIndex((link) =>
        isSource
          ? link.target === currentLink.target
          : link.source === currentLink.source
      )

      // Only accumulate heights for links that come before the current link
      for (let i = 0; i < currentLinkIndex; i++) {
        const link = relevantLinks[i]
        const sourceNode = nodes.find((n) => n.id === link.source) as Node
        const targetNode = nodes.find((n) => n.id === link.target) as Node
        const width = getLinkWidth(
          sourceNode,
          targetNode,
          isSource ? 'source' : 'target'
        )
        cumulativeHeight += width
      }

      const baseY = isSource ? node.y1 ?? 0 : node.y0 ?? 0
      return baseY + cumulativeHeight
    },
    [links, nodes, getLinkWidth]
  )

  if (links.length === 0) return null

  return (
    <>
      {links.map((link, index) => {
        const sourceNode = nodes.find((n) => n.id === link.source) as Node
        const targetNode = nodes.find((n) => n.id === link.target) as Node
        const isUnspent = targetNode.textInfo[0] === 'Unspent'
        const isRemainingBalance = targetNode.localId === 'remainingBalance'
        const isMinerFee = targetNode.localId === 'minerFee'
        const maxDepthH = Math.max(...nodes.map((n) => n.depthH))
        const isCurrentInput =
          targetNode.depthH === maxDepthH - 1 ||
          sourceNode.depthH === maxDepthH - 1

        const y1 =
          sourceNode.type === 'block'
            ? getStackedYPosition(sourceNode, true, link)
            : sourceNode.y1 ?? 0

        const y2 =
          targetNode.type === 'block'
            ? getStackedYPosition(targetNode, false, link)
            : targetNode.y0 ?? 0

        const points: LinkPoints = {
          souceWidth: getLinkWidth(sourceNode, targetNode, 'source'),
          targetWidth: getLinkWidth(sourceNode, targetNode, 'target'),
          x1:
            sourceNode.type === 'block'
              ? (sourceNode.x1 ?? 0) -
                (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
              : sourceNode.x1 ?? 0,
          y1,
          x2:
            targetNode.type === 'block'
              ? (targetNode.x0 ?? 0) +
                (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
              : targetNode.x0 ?? 0,
          y2
        }
        const path1 = generateCustomLink(points)

        return (
          <Group key={index}>
            <Path
              key={index}
              path={path1}
              style="fill"
              color={isCurrentInput || isUnspent ? 'white' : gray[700]}
              opacity={isCurrentInput || isUnspent ? 1 : 0.8}
            >
              {(isCurrentInput || isMinerFee) &&
              !isRemainingBalance &&
              !isUnspent ? (
                <>
                  <Paint opacity={0.6}>
                    <LinearGradient
                      start={vec(points.x1, points.y1)}
                      end={vec(points.x2, points.y2)}
                      colors={['#363636', '#363636']}
                      positions={[0, 1]}
                    />
                  </Paint>

                  <Paint opacity={1}>
                    <LinearGradient
                      start={vec(
                        targetNode.type === 'block' ? points.x1 : points.x2,
                        (points.y1 + points.y2) / 2
                      )}
                      end={vec(
                        targetNode.type === 'block' ? points.x2 : points.x1,
                        (points.y1 + points.y2) / 2
                      )}
                      colors={['#2C2C2C', '#FFFFFF']}
                      positions={[0, 0.7]}
                    />
                  </Paint>
                </>
              ) : isUnspent && !isRemainingBalance ? (
                <>
                  <Paint opacity={1}>
                    <LinearGradient
                      start={vec(
                        targetNode.type === 'block' ? points.x1 : points.x2,
                        (points.y1 + points.y2) / 2
                      )}
                      end={vec(
                        targetNode.type === 'block' ? points.x2 : points.x1,
                        (points.y1 + points.y2) / 2
                      )}
                      colors={['#2C2C2C', '#FFFFFF']}
                      positions={[0, 0.2]}
                    />
                  </Paint>
                </>
              ) : !isUnspent && !isRemainingBalance ? (
                <>
                  <Paint opacity={0.2}>
                    <LinearGradient
                      start={vec(points.x1, points.y1)}
                      end={vec(points.x2, points.y2)}
                      colors={['#363636', '#363636']}
                      positions={[0, 1]}
                    />
                  </Paint>

                  <Paint opacity={0.2}>
                    <LinearGradient
                      start={vec(
                        targetNode.type === 'block' ? points.x1 : points.x2,
                        (points.y1 + points.y2) / 2
                      )}
                      end={vec(
                        targetNode.type === 'block' ? points.x2 : points.x1,
                        (points.y1 + points.y2) / 2
                      )}
                      colors={['#FFFFFF', '#2C2C2C']}
                      positions={[0, 1]}
                    />
                  </Paint>
                </>
              ) : null}
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
  const A = [x1, y1] // Point A
  const B = [x1, y1 + souceWidth] // Point B
  const C = [x2, y2] // Point C
  const D = [x2, y2 + targetWidth] // Point D

  // Curve control point percentages - adjust these to experiment with curve shapes
  const firstCurveFirstControlX = 0 // 0 means same as source point
  const firstCurveSecondControlX = 0.3 // 0.3 of the way from source to target
  const midpointX = 1 / 2 // Halfway between source and target
  const midpointY = 1 / 2 // Halfway between source and target heights
  const secondCurveSecondControlX = 0.7 // 0.7 of the way from source to target

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

export default SSSankeyLinks
