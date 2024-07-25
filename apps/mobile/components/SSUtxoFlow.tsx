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
import type { SankeyLink, SankeyNode } from 'd3-sankey'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import React, { useCallback, useMemo } from 'react'
import { View } from 'react-native'

import { Colors } from '@/styles'
import { Utxo } from '@/types/models/Utxo'

interface NodeData {
  name: string
  value: number
  index: number
  fromAddress: string
  label: string
  children: string[]
}

interface LinkData {
  source: number
  target: number
  value: number
}

interface SankeyData {
  nodes: SankeyNode<NodeData, LinkData>[]
  links: SankeyLink<NodeData, LinkData>[]
}
interface TransactionFlowSankeyProps {
  width: number
  height: number
  centerX: number
  centerY: number
  inputs: Utxo[]
  outputs: { type: string; value: number }[]
  vSize: number
  walletAddress: string
}
const TransactionFlowSankey: React.FC<TransactionFlowSankeyProps> = ({
  width,
  height,
  centerX,
  centerY,
  inputs,
  outputs,
  vSize,
  walletAddress
}) => {
  const data: SankeyData = useMemo(() => {
    if (
      !inputs ||
      !outputs ||
      !Array.isArray(inputs) ||
      !Array.isArray(outputs)
    ) {
      return { nodes: [], links: [] }
    }

    const nodes: NodeData[] = [
      ...inputs.map((input, index) => ({
        id: `input-${index}-${input.txid.slice(0, 8)}`,
        name: `${input.value.toLocaleString()} sats`,
        value: input.value,
        index,
        fromAddress: ` ${walletAddress}`,
        label: input.label || '',
        children: [`${vSize} vB`]
      })),
      {
        id: 'vsize',
        name: `${vSize} vB`,
        value: inputs.reduce((acc, input) => acc + input.value, 0),
        index: inputs.length,
        fromAddress: ``,
        label: '',
        children: outputs.map((output) => `${output.value} sats`)
      },
      ...outputs.map((output, index) => ({
        id: `output-${index}`,
        name: `${output.value.toLocaleString()} sats`,
        value: output.value,
        index: inputs.length + 1 + index,
        fromAddress: ``,
        children: [],
        label: ''
      }))
    ]

    const links: LinkData[] = [
      ...inputs.map((input, index) => ({
        source: index,
        target: inputs.length,
        value: input.value
      })),
      ...outputs.map((output, index) => ({
        source: inputs.length,
        target: inputs.length + 1 + index,
        value: output.value
      }))
    ]

    return { nodes, links }
  }, [inputs, outputs, vSize, walletAddress])

  const sankeyLayout: any = sankey()
    .nodeWidth(48)
    .nodePadding(80)
    .extent([
      [20, 160],
      [width - 20, height - 160]
    ])
    .nodeId((node: any) => node.id)
  // .nodeAlign(sankeyRight)

  const { nodes, links } = sankeyLayout(data)

  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
  })

  const nodeParagraph = useCallback(
    (text: string, textAlign = TextAlign.Left) => {
      if (!customFontManager) return null

      const textStyle = {
        color: Skia.Color('white'),
        fontFamilies: ['SF Pro Text'],
        fontSize: 14,
        fontStyle: {
          weight: 400
        },
        backgroundColor: Skia.Color('red') // Add this line
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

  const fromParagraph = useCallback(
    (walletAddress: string) => {
      if (!customFontManager) return null

      const textStyle = {
        color: Skia.Color('white'),
        fontFamilies: ['SF Pro Text'],
        fontSize: 11,
        fontStyle: {
          weight: 400
        }
      }
      const para = Skia.ParagraphBuilder.Make({
        maxLines: 1,
        textAlign: TextAlign.Left
      })
        .pushStyle({ ...textStyle, color: Skia.Color(Colors.gray[500]) })
        .addText(`from `)
        .pushStyle(textStyle)
        .addText(`${walletAddress}`)
        .pop()
        .build()
      para.layout(200)
      return para
    },
    [customFontManager]
  )

  return (
    <View>
      <Canvas style={{ width, height, borderColor: 'red', borderWidth: 1 }}>
        <Group origin={{ x: centerX, y: centerY }}>
          {links?.map((link: any, i: number) => {
            const linkGenerator = sankeyLinkHorizontal()
            const path = linkGenerator(link)

            return (
              <Path
                key={i}
                path={path ?? ''}
                color={Colors.gray[700]}
                style="stroke"
                strokeJoin="round"
                strokeWidth={Math.max(1, link.width)}
              />
            )
          })}
          {walletAddress &&
            nodes?.map((node: any) => {
              const isMiddleNode = node.depth === 1 // Middle layer is the source
              const isOutput = node.depth === 2 // Output layer is the last layer
              const isInput = node.depth === 0
              const textAlign = isOutput ? TextAlign.Right : TextAlign.Left

              return (
                <Group key={node.name}>
                  {isMiddleNode ? (
                    <Group>
                      <Rect
                        x={node.x0}
                        y={node.y0}
                        width={sankeyLayout.nodeWidth()}
                        height={node.y1 - node.y0}
                        color="#FFF"
                        style="fill"
                      />
                      <Paragraph
                        paragraph={nodeParagraph(node.name, TextAlign.Center)}
                        x={node.x0}
                        y={
                          node.y0 +
                          (node.y1 - node.y0) / 2 -
                          (nodeParagraph(
                            node.name,
                            TextAlign.Center
                          )?.getHeight() ?? 0) /
                            2 +
                          node.y1 -
                          node.y0
                        }
                        width={sankeyLayout.nodeWidth()}
                      />
                    </Group>
                  ) : (
                    <Group>
                      <Paragraph
                        paragraph={nodeParagraph(node.name, textAlign)}
                        x={isOutput ? node.x0 - 60 : node.x0}
                        y={
                          node.y0 +
                          (node.y1 - node.y0) / 2 -
                          (nodeParagraph(node.name)?.getHeight() ?? 0) / 2
                        }
                        width={100}
                      />
                      {isInput && (
                        <Paragraph
                          paragraph={fromParagraph(walletAddress)}
                          x={node.x0}
                          y={
                            node.y0 +
                            (node.y1 - node.y0) / 2 -
                            (fromParagraph(walletAddress)?.getHeight() ?? 0) /
                              2 +
                            (fromParagraph(walletAddress)?.getHeight() ?? 0) * 2
                          }
                          width={200}
                        />
                      )}
                    </Group>
                  )}
                </Group>
              )
            })}
        </Group>
      </Canvas>
    </View>
  )
}

export default TransactionFlowSankey
