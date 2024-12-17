import {
  Canvas,
  Group,
  Paragraph,
  Path,
  Rect,
  Skia,
  TextAlign,
  useFonts
} from '@shopify/react-native-skia'
import type { SankeyLinkMinimal, SankeyNodeMinimal } from 'd3-sankey'
import { sankey } from 'd3-sankey'
import React, { useCallback } from 'react'

import linkList from './sankeylinks.json'
import nodeList from './sankeynode.json'

interface Link extends SankeyLinkMinimal<object, object> {
  source: string
  target: string
  value: number
  dash?: boolean
}

interface Node extends SankeyNodeMinimal<object, object> {
  indexC: number
  id: string
  depthH: number
  type?: string
  textInfo: string[]
}

interface Data {
  nodes: Node[]
  links: Link[]
}

const data: Data = {
  nodes: nodeList.map((item) => ({
    id: String(item.indexC),
    indexC: item.indexC,
    depthH: item.depthH,
    type: item.type,
    textInfo: item.textInfo
  })),
  links: linkList.map((item) => ({
    source: item.source,
    target: item.target,
    value: 100,
    dash: item.dash
  }))
}

interface LinkPoints {
  souceWidth: number
  targetWidth: number
  x1: number
  y1: number
  x2: number
  y2: number
}
const CustomLink = (points: LinkPoints, dash: boolean = false) => {
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

const sankeyGenerator = sankey()
  .nodeWidth(48)
  .nodePadding(100)
  .extent([
    [20, 160],
    [1000 * 1.2, 1000 - 160]
  ])
  .nodeId((node: any) => node.id)

sankeyGenerator.nodeAlign((node: any) => {
  const { depthH } = node
  const depth = depthH - 1
  return depth
})

const { nodes, links } = sankeyGenerator(data)

const SankeyDiagram = () => {
  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
  })

  const nodeParagraph = useCallback(
    (text: string, textAlign = TextAlign.Left, color = '#4F4F4F') => {
      if (!customFontManager) return null

      const textStyle = {
        color: Skia.Color(color),
        fontFamilies: ['SF Pro Text'],
        fontSize: 14,
        fontStyle: {
          weight: 400
        }
      }
      const para = Skia.ParagraphBuilder.Make({
        maxLines: 1,
        textAlign,
        strutStyle: {
          strutEnabled: true,
          forceStrutHeight: true,
          heightMultiplier: 1.5, // Adjust this value to control the background height
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

  return (
    <Canvas
      style={{
        width: 2000,
        height: 2000,
        borderColor: 'red',
        borderWidth: 1
      }}
    >
      {links.map((link, index) => {
        const points: LinkPoints = {
          souceWidth: (link.source as Node).type === 'block' ? 10 : 20,
          targetWidth: (link.target as Node).type === 'block' ? 10 : 20,
          x1: (link.source as Node).x1 ?? 0,
          y1: (link.source as Node).y1 ?? 0,
          x2: (link.target as Node).x0 ?? 0,
          y2: (link.target as Node).y0 ?? 0
        }
        const linkData = link as Link
        const path1 = CustomLink(points, linkData.dash ?? false)
        console.log(`dash ${linkData.dash ?? false} path: ${path1} `)
        return (
          <Path
            key={index}
            path={path1}
            strokeWidth={10}
            style="fill"
            color="#252525"
          />
        )
      })}

      {/* Draw nodes */}
      {nodes.map((node, index) => {
        const dataNode = node as Node
        const lineH =
          nodeParagraph(
            dataNode.textInfo[1] ?? '',
            TextAlign.Center
          )?.getHeight() ?? 0

        const blockRect = () => {
          if (dataNode.type === 'block') {
            const padding = 4
            return (
              <Group>
                <Rect
                  x={(node.x0 ?? 0) - padding / 2}
                  y={(node.y0 ?? 0) - 0.5 * lineH - padding / 2}
                  width={(node.x1 ?? 0) - (node.x0 ?? 0) + padding}
                  height={lineH + padding}
                  strokeWidth={3}
                  style="stroke"
                  color="#7E7E7E"
                />
                <Rect
                  x={node.x0 ?? 0}
                  y={(node.y0 ?? 0) - 0.5 * lineH}
                  width={(node.x1 ?? 0) - (node.x0 ?? 0)}
                  height={lineH}
                  color="#393939"
                />
              </Group>
            )
          }
          return null
        }
        return (
          <Group key={index}>
            <Paragraph
              paragraph={nodeParagraph(
                dataNode.textInfo[0] ?? '',
                TextAlign.Center
              )}
              x={node.x0 ?? 0}
              y={(node.y0 ?? 0) - 1.8 * lineH}
              width={sankeyGenerator.nodeWidth()}
            />

            {blockRect()}

            <Paragraph
              paragraph={nodeParagraph(
                dataNode.textInfo[1] ?? '',
                TextAlign.Center,
                dataNode.type === 'block' ? '#828282' : '#4F4F4F'
              )}
              x={node.x0 ?? 0}
              y={(node.y0 ?? 0) - 0.5 * lineH}
              width={sankeyGenerator.nodeWidth()}
            />

            <Paragraph
              paragraph={nodeParagraph(
                dataNode.textInfo[2] ?? '',
                TextAlign.Center
              )}
              x={node.x0 ?? 0}
              y={(node.y1 ?? 0) + 0.8 * lineH}
              width={sankeyGenerator.nodeWidth()}
            />

            {/* <Paragraph
                paragraph={nodeParagraph(dataNode.id, TextAlign.Center)}
                x={node.x0 ?? 0}
                y={node.y0 ?? 0}
                width={sankeyGenerator.nodeWidth()}
              /> */}
          </Group>
        )
      })}
    </Canvas>
  )
}

export default SankeyDiagram
