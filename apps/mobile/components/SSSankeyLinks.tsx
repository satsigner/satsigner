import {
  Group,
  LinearGradient,
  Paint,
  Path,
  vec
} from '@shopify/react-native-skia'
import { useCallback } from 'react'

import type { TxNode } from '@/hooks/useNodesAndLinks'
import { gray } from '@/styles/colors'
import { logAttenuation } from '@/utils/math'

interface Node {
  id: string
  depthH: number
  type: string
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
  ioData: TxNode['ioData']
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

function SSSankeyLinks({
  links,
  nodes,
  sankeyGenerator,
  BLOCK_WIDTH
}: SSSankeyLinksProps) {
  const getLinkWidth = useCallback(
    (sourceNode: Node, targetNode: Node, type: string): number => {
      const node = type === 'source' ? sourceNode : targetNode

      // Calculate total width from the block node
      let totalWidthFromBlock = 0
      if (node.type === 'block') {
        const relevantLinks = links.filter((link) => {
          if (type === 'source') {
            return link.source === node.id
          } else {
            return link.target === node.id
          }
        })

        for (const link of relevantLinks) {
          const currentSourceNode = nodes.find(
            (n) => n.id === link.source
          ) as Node
          const currentTargetNode = nodes.find(
            (n) => n.id === link.target
          ) as Node

          const otherNode =
            type === 'source' ? currentTargetNode : currentSourceNode
          const value = otherNode.value ?? 0
          const linkWidth = logAttenuation(value)
          totalWidthFromBlock += linkWidth
        }
      }
      if (type === 'source') {
        if (node.type === 'block') {
          const txWidth = logAttenuation(node.value ?? 0)
          const targetWidth = logAttenuation(targetNode.value ?? 0)

          const w = (targetWidth / totalWidthFromBlock) * txWidth
          return w
        } else if (node.type === 'text') {
          const width = logAttenuation(node.value ?? 0)
          return width
        }
      } else if (type === 'target') {
        if (node.type === 'block') {
          const value = sourceNode.value ?? 0
          const txWidth = logAttenuation(node.value ?? 0)
          const width = logAttenuation(value)
          const w = (width / totalWidthFromBlock) * txWidth
          return w
          // return width
        } else if (node.type === 'text') {
          const width = logAttenuation(node.value ?? 0)
          return width
        }
      }
      return 0 // Add default return value to ensure number is always returned
    },
    [links, nodes] // Add dependencies
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
        const isUnspent = targetNode.ioData?.isUnspent
        const isRemainingBalance = targetNode.localId === 'remainingBalance'
        const isCurrentTxMinerFee = targetNode.localId === 'current-minerFee'
        const maxDepthH = Math.max(...nodes.map((n) => n.depthH))
        const isCurrentTx =
          targetNode.depthH === maxDepthH - 1 ||
          sourceNode.depthH === maxDepthH - 1

        const isFromTransactionChart = maxDepthH === 2
        const isCurrentInput = isFromTransactionChart && sourceNode.depthH === 0

        const y1 =
          sourceNode.type === 'block'
            ? getStackedYPosition(sourceNode, true, link)!
            : sourceNode.y1 ?? 0

        const y2 =
          targetNode.type === 'block'
            ? getStackedYPosition(targetNode, false, link)!
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

        if (targetNode.value === 0 && targetNode.depthH === maxDepthH) {
          return null
        }

        return (
          <Group key={index}>
            <Path
              key={index}
              path={path1}
              style="fill"
              color={isCurrentTx || isUnspent ? 'white' : gray[700]}
              opacity={isCurrentTx || isUnspent ? 1 : 0.5}
            >
              {(isCurrentTx || isCurrentTxMinerFee) &&
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
                      colors={[gray[900], isCurrentInput ? gray[500] : 'white']}
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
