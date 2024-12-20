import {
  Canvas,
  Group,
  Path,
  Rect,
  Skia,
  TextAlign,
  TileMode,
  useFonts,
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
const LINK_MAX_WIDTH = 60
const generateCustomLink = (points: LinkPoints, dash: boolean = false) => {
  const { x1, y1, x2, y2, souceWidth, targetWidth } = points

  // Define the coordinates of the four points
  const A = [x1, y1 - souceWidth / 2] // Point A
  const B = [x1, y1 + souceWidth / 2] // Point B
  const C = [x2, y2 - targetWidth / 2] // Point C
  const D = [x2, y2 + targetWidth / 2] // Point D

  if (!dash) {
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

  // Calculate the Bezier curve path points
  const quadraticBezier = (t: number, P0: any, P1: any, P2: any) => {
    const x =
      Math.pow(1 - t, 2) * P0.x + 2 * (1 - t) * t * P1.x + Math.pow(t, 2) * P2.x // Calculate x coordinate

    const y =
      Math.pow(1 - t, 2) * P0.y + 2 * (1 - t) * t * P1.y + Math.pow(t, 2) * P2.y // Calculate y coordinate

    return { x, y } // Return the calculated point
  }

  const steps = 20
  const pointsB2CD = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    return quadraticBezier(
      t,
      { x: B[0], y: B[1] },
      { x: B[0] + (D[0] - B[0]) / 3, y: B[1] },
      { x: B[0] + (D[0] - B[0]) / 2, y: B[1] + (D[1] - B[1]) / 2 }
    )
  })
  const pointsCD2D = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    return quadraticBezier(
      t,
      { x: B[0] + (D[0] - B[0]) / 2, y: B[1] + (D[1] - B[1]) / 2 },
      { x: B[0] + ((D[0] - B[0]) / 3) * 2, y: D[1] },
      { x: D[0], y: D[1] }
    )
  })
  const pointB2D = pointsB2CD.concat(pointsCD2D)

  const pointsC2CA = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    return quadraticBezier(
      t,
      { x: C[0], y: C[1] },
      { x: C[0] + (A[0] - C[0]) / 3, y: C[1] },
      { x: C[0] + (A[0] - C[0]) / 2, y: C[1] + (A[1] - C[1]) / 2 }
    )
  })
  const pointsCA2A = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    return quadraticBezier(
      t,
      { x: C[0] + (A[0] - C[0]) / 2, y: C[1] + (A[1] - C[1]) / 2 },
      { x: C[0] + ((A[0] - C[0]) / 3) * 2, y: A[1] },
      { x: A[0], y: A[1] }
    )
  })
  const pointC2A = pointsC2CA.concat(pointsCA2A).reverse()

  const dashPathStr = Array.from({ length: steps }, (_, i) => {
    const point1 = pointB2D[i * 2]
    const point2 = pointC2A[i * 2]
    const point3 = pointC2A[i * 2 + 1]
    const point4 = pointB2D[i * 2 + 1]
    const moveTo1 = `M ${point1.x} ${point1.y}`
    const lineTo2 = `L ${point2.x} ${point2.y}`
    const lineTo3 = `L ${point3.x} ${point3.y}`
    const lineTo4 = `L ${point4.x} ${point4.y}`
    return [moveTo1, lineTo2, lineTo3, lineTo4, 'Z'].join('\n')
  })

  return dashPathStr.join('\n')
}

interface SankeyProps {
  sankeyNodes: Node[]
  sankeyLinks: Link[]
  inputCount: number
}

const SankeyDiagram = ({
  sankeyNodes,
  sankeyLinks,
  inputCount
}: SankeyProps) => {
  const sankeyGenerator = sankey()
    .nodeWidth(76)
    .nodePadding(100)
    .extent([
      [20, 160],
      [1000 * 0.4, 1000 * (Math.max(2.4, inputCount) / 10)]
    ])
    .nodeId((node: any) => node.id)

  sankeyGenerator.nodeAlign((node: any) => {
    const { depthH } = node
    const depth = depthH - 1
    return depth
  })

  const { nodes, links } = sankeyGenerator({
    // nodes: data.nodes,
    nodes: sankeyNodes,
    links: sankeyLinks.map((item) => ({
      source: item.source,
      target: item.target,
      value: item.value
    }))
  })

  const getUtxoWidth = (node: Node, maxWidth: number) => {
    // Find all nodes at the same depth as the target node
    const nodesAtSameDepth = nodes.filter((n) => n.depthH === node.depthH)

    // Calculate total sats at this depth
    const totalSats = nodesAtSameDepth.reduce((sum, n) => {
      const sats = n?.value ?? 0
      return sum + sats
    }, 0)

    // Get current node's sats
    const nodeSats = node?.value ?? 0

    // Calculate width (max width proportional to sats percentage)
    return (nodeSats / totalSats) * maxWidth
  }

  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
  })

  const nodeParagraph = useCallback(
    ({
      text = '',
      textAlign = TextAlign.Left,
      color = '#4F4F4F',
      weight = 400
    }) => {
      if (!customFontManager) return null

      const textStyle = {
        color: Skia.Color(color),
        fontFamilies: ['SF Pro Text'],
        fontSize: 14,
        fontStyle: {
          weight
        }
      }
      const para = Skia.ParagraphBuilder.Make({
        maxLines: 1,
        textAlign,
        strutStyle: {
          strutEnabled: true,
          forceStrutHeight: true,
          heightMultiplier: 1.6, // Adjust this value to control the background height
          leading: 0
        }
      })
        .pushStyle({ ...textStyle })
        .addText(`${text}`)
        .pop()
        .build()
      para.layout(100)
      return para
    },
    [customFontManager]
  )

  if (!sankeyNodes || sankeyNodes.length === 0) {
    return null
  }

  if (!nodes || !links) {
    return null
  }

  return (
    <Canvas
      style={{
        width: 2000,
        height: 2000,
        borderColor: 'red',
        borderWidth: 1
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
                ? Math.min(5, getUtxoWidth(targetNode, LINK_MAX_WIDTH))
                : getUtxoWidth(sourceNode, LINK_MAX_WIDTH),
            targetWidth:
              targetNode.type === 'block'
                ? Math.min(5, getUtxoWidth(targetNode, LINK_MAX_WIDTH))
                : getUtxoWidth(targetNode, LINK_MAX_WIDTH),
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
          const path1 = generateCustomLink(points, false)

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
          const lineH =
            nodeParagraph({
              text: dataNode.textInfo[0] ?? '',
              textAlign: TextAlign.Center
            })?.getHeight() ?? 0

          const blockRect = () => {
            if (dataNode.type === 'block') {
              return (
                <Group>
                  <Rect
                    x={(node.x0 ?? 0) + (sankeyGenerator.nodeWidth() - 50) / 2}
                    y={(node.y0 ?? 0) - 0.5 * lineH}
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
                y={(node.y0 ?? 0) - 1.8 * lineH}
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

export default SankeyDiagram
