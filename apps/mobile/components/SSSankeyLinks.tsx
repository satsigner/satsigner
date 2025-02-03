import { Group, Path, Skia, TileMode, vec } from '@shopify/react-native-skia'

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
  getLinkWidth: (node: Node, maxWidth: number) => number
  generateCustomLink: (points: LinkPoints) => string
  LINK_MAX_WIDTH: number
  BLOCK_WIDTH: number
}

export function SSSankeyLinks({
  links,
  nodes,
  sankeyGenerator,
  getLinkWidth,
  generateCustomLink,
  LINK_MAX_WIDTH,
  BLOCK_WIDTH
}: SSSankeyLinksProps) {
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
