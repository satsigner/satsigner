import { Group, Path, Skia, TileMode, vec } from '@shopify/react-native-skia'
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

export function SSSankeyLinks({
  links,
  nodes,
  sankeyGenerator,
  LINK_MAX_WIDTH,
  BLOCK_WIDTH
}: SSSankeyLinksProps) {
  const getLinkWidth = useCallback(
    (node: Node, maxWidth: number) => {
      // For block nodes, return a fixed small width
      if (node.type === 'block') {
        return Math.min(2, maxWidth)
      }

      // Calculate total value of all links in the diagram
      const totalLinkValue = links.reduce(
        (sum, link) => sum + (link.value ?? 0),
        0
      )

      // Get current node's sats
      const nodeSats = node?.value ?? 0

      // Find links where this node is the target (incoming) or source (outgoing)
      const incomingLinks = links.filter((link) => {
        const targetNode = link.target
        return targetNode === node.id
      })

      const outgoingLinks = links.filter((link) => {
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

      // Determine if this is a source or target node
      const isSource = outgoingLinks.some(
        (link) => (link.source as string) === node.id
      )

      // Calculate width proportional to the node's value relative to total link value
      // This ensures consistent total width across all nodes
      const calculatedWidth = (nodeSats / totalLinkValue) * maxWidth

      if (!isSource) {
        // console.log('start', nodeSats)
        console.log('XX', { isSource })
        console.log({ nodeSats, totalOutgoingSats, totalIncomingSats })
        // console.log('end', nodeSats)
        console.log({ maxWidth, calculated: calculatedWidth })
      }

      return calculatedWidth
    },
    [links]
  )

  if (links.length === 0) return null

  return (
    <>
      {links.map((link, index) => {
        const sourceNode = nodes.find((n) => n.id === link.source) as Node
        const targetNode = nodes.find((n) => n.id === link.target) as Node
        const isUnspent = targetNode.textInfo[0] === 'Unspent'

        const points: LinkPoints = {
          souceWidth:
            sourceNode.type === 'block'
              ? Math.min(2, getLinkWidth(sourceNode, LINK_MAX_WIDTH))
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
    </>
  )
}

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
