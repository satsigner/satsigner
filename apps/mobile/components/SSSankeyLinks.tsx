import {
  Group,
  Path,
  Skia,
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
  sourceWidth: number
  targetWidth: number
  x1: number
  y1: number
  x2: number
  y2: number
}

interface SSSankeyLinksProps {
  links: Link[]
  nodes: Node[]
  sankeyGenerator: { nodeWidth: () => number }
  BLOCK_WIDTH: number
  selectedOutputNode?: string
  dimUnselected?: boolean
}

function buildSolidPaint(hexColor: string, alpha: number) {
  const paint = Skia.Paint()
  paint.setColor(Skia.Color(hexColor))
  paint.setAlphaf(alpha)
  return paint
}

function buildLinearGradientPaint(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  colors: string[],
  positions: number[],
  alpha = 1
) {
  const paint = Skia.Paint()
  if (alpha < 1) paint.setAlphaf(alpha)
  paint.setShader(
    Skia.Shader.MakeLinearGradient(
      vec(startX, startY),
      vec(endX, endY),
      colors.map((c) => Skia.Color(c)),
      positions,
      0,
      Skia.Matrix()
    )
  )
  return paint
}

function SSSankeyLinks({
  links,
  nodes,
  sankeyGenerator,
  BLOCK_WIDTH,
  selectedOutputNode,
  dimUnselected = false
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
          }
          return link.target === node.id
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
          }
          return link.target === node.id
        })
        .toSorted((a, b) => {
          const aNode = isSource
            ? nodes.find((n) => n.id === a.target)
            : nodes.find((n) => n.id === a.source)
          const bNode = isSource
            ? nodes.find((n) => n.id === b.target)
            : nodes.find((n) => n.id === b.source)

          // Sort by y0 for incoming links, y1 for outgoing links
          const aY = isSource ? (aNode?.y0 ?? 0) : (aNode?.y1 ?? 0)
          const bY = isSource ? (bNode?.y0 ?? 0) : (bNode?.y1 ?? 0)

          return aY - bY // Sort from top to bottom
        })

      // Find index of current link in sorted links
      const currentLinkIndex = relevantLinks.findIndex((link) =>
        isSource
          ? link.target === currentLink.target
          : link.source === currentLink.source
      )

      // Only accumulate heights for links that come before the current link
      for (let i = 0; i < currentLinkIndex; i += 1) {
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

      const baseY = isSource ? (node.y1 ?? 0) : (node.y0 ?? 0)
      return baseY + cumulativeHeight
    },
    [links, nodes, getLinkWidth]
  )
  if (links.length === 0) {
    return null
  }

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

        const isSelectedOutput =
          selectedOutputNode !== undefined &&
          targetNode.localId === selectedOutputNode
        const shouldDim =
          dimUnselected &&
          selectedOutputNode !== undefined &&
          !isSelectedOutput &&
          targetNode.depthH === 2

        const y1 =
          sourceNode.type === 'block'
            ? getStackedYPosition(sourceNode, true, link)!
            : (sourceNode.y1 ?? 0)

        const y2 =
          targetNode.type === 'block'
            ? getStackedYPosition(targetNode, false, link)!
            : (targetNode.y0 ?? 0)

        const points: LinkPoints = {
          sourceWidth: getLinkWidth(sourceNode, targetNode, 'source'),
          targetWidth: getLinkWidth(sourceNode, targetNode, 'target'),
          x1:
            sourceNode.type === 'block'
              ? (sourceNode.x1 ?? 0) -
                (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
              : (sourceNode.x1 ?? 0),
          x2:
            targetNode.type === 'block'
              ? (targetNode.x0 ?? 0) +
                (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
              : (targetNode.x0 ?? 0),
          y1,
          y2
        }
        const path1 = generateCustomLink(points)

        if (targetNode.value === 0 && targetNode.depthH === maxDepthH) {
          return null
        }

        const midY = (points.y1 + points.y2) / 2
        const gradStartX =
          targetNode.type === 'block' ? points.x1 : points.x2
        const gradEndX = targetNode.type === 'block' ? points.x2 : points.x1

        return (
          <Group key={`${link.source}-${link.target}-${index}`} opacity={shouldDim ? 0.2 : 1}>
            <Path
              path={path1}
              style="fill"
              color={isCurrentTx || isUnspent ? 'white' : gray[700]}
              opacity={isCurrentTx || isUnspent ? 1 : 0.5}
            />
            {(isCurrentTx || isCurrentTxMinerFee) &&
            !isRemainingBalance &&
            !isUnspent ? (
              <>
                <Path
                  path={path1}
                  style="fill"
                  paint={buildSolidPaint('#363636', 0.6)}
                />
                <Path
                  path={path1}
                  style="fill"
                  paint={buildLinearGradientPaint(
                    gradStartX,
                    midY,
                    gradEndX,
                    midY,
                    [gray[900], isCurrentInput ? gray[500] : '#FFFFFF'],
                    [0, 0.7]
                  )}
                />
              </>
            ) : isUnspent && !isRemainingBalance ? (
              <Path
                path={path1}
                style="fill"
                paint={buildLinearGradientPaint(
                  gradStartX,
                  midY,
                  gradEndX,
                  midY,
                  ['#2C2C2C', '#FFFFFF'],
                  [0, 0.2]
                )}
              />
            ) : !isUnspent && !isRemainingBalance ? (
              <>
                <Path
                  path={path1}
                  style="fill"
                  paint={buildSolidPaint('#363636', 0.2)}
                />
                <Path
                  path={path1}
                  style="fill"
                  paint={buildLinearGradientPaint(
                    gradStartX,
                    midY,
                    gradEndX,
                    midY,
                    ['#FFFFFF', '#2C2C2C'],
                    [0, 1],
                    0.2
                  )}
                />
              </>
            ) : null}
          </Group>
        )
      })}
    </>
  )
}

const generateCustomLink = (points: LinkPoints) => {
  const { x1, y1, x2, y2, sourceWidth, targetWidth } = points

  // Define the coordinates of the four points
  const A = [x1, y1] // Top-left (source top)
  const B = [x1, y1 + sourceWidth] // Bottom-left (source bottom)
  const C = [x2, y2] // Top-right (target top)
  const D = [x2, y2 + targetWidth] // Bottom-right (target bottom)

  // Calculate horizontal distance for adaptive control points
  const horizontalDistance = Math.abs(x2 - x1)

  // Adaptive control point calculation based on distance
  // Use a fraction of the horizontal distance for smoother curves
  // Cap at 60px to prevent overly stretched curves on wide layouts
  const controlPointOffset = Math.min(horizontalDistance * 0.4, 60)

  // Control points for the curve from B to D (bottom curve)
  // First control point extends horizontally from B, second from D
  const [bX, bY] = B
  const [dX, dY] = D
  const [cX, cY] = C
  const [aX, aY] = A

  const bottomCurveCP1X = bX + controlPointOffset
  const bottomCurveCP1Y = bY
  const bottomCurveCP2X = dX - controlPointOffset
  const bottomCurveCP2Y = dY

  // Control points for the curve from C to A (top curve)
  // First control point extends horizontally from C, second from A
  const topCurveCP1X = cX - controlPointOffset
  const topCurveCP1Y = cY
  const topCurveCP2X = aX + controlPointOffset
  const topCurveCP2Y = aY

  // Build the path
  const moveToA = `M ${A[0]} ${A[1]}`
  const lineToB = `L ${B[0]} ${B[1]}`

  // Bottom curve: B -> D
  const curveToD = `C ${bottomCurveCP1X} ${bottomCurveCP1Y}, ${bottomCurveCP2X} ${bottomCurveCP2Y}, ${D[0]} ${D[1]}`

  const lineToC = `L ${C[0]} ${C[1]}`

  // Top curve: C -> A
  const curveToA = `C ${topCurveCP1X} ${topCurveCP1Y}, ${topCurveCP2X} ${topCurveCP2Y}, ${A[0]} ${A[1]}`

  return [moveToA, lineToB, curveToD, lineToC, curveToA, 'Z'].join(' ')
}

export default SSSankeyLinks
