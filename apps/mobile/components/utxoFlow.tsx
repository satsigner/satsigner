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
import {
  sankey,
  sankeyCenter,
  sankeyJustify,
  sankeyLinkHorizontal,
  sankeyRight
} from 'd3-sankey'
import React, { useCallback, useMemo } from 'react'
import { View } from 'react-native'

import { Colors } from '@/styles'
import { Utxo } from '@/types/models/Utxo'

interface NodeData {
  id: string
  name: string
  value: number
  index?: number
  fromAddress?: string
  toAddress?: string
  label?: string
  children: string[]
}

interface LinkData {
  source: string | number
  target: string | number
  value: number
}

interface SankeyData {
  nodes: SankeyNode<NodeData, LinkData>[]
  links: SankeyLink<NodeData, LinkData>[]
}

interface Inputs {
  id: string
  name: string
  value: number
  fromAddress: string
}

interface Outputs {
  id: string
  name: string
  value: number
  toAddress: string
}

interface Transaction {
  inputs: Inputs[]
  outputs: Outputs[]
  vSize: number
}

const pendingTransaction: Transaction = {
  inputs: [
    { id: 'input-1', name: '9,351 sats', value: 9351, fromAddress: 'Address1' },
    { id: 'input-2', name: '23 sats', value: 23, fromAddress: 'Address1' },
    { id: 'input-3', name: '5,101 sats', value: 5101, fromAddress: 'Address1' }
  ],
  outputs: [
    {
      id: 'output-1',
      name: '10,351 sats',
      value: 10351,
      toAddress: 'Address2'
    },
    { id: 'output-2', name: '3,543 sats', value: 3543, toAddress: 'Address1' }
  ],
  vSize: 521
}

const completedTransaction: Transaction = {
  inputs: [
    {
      id: 'input-4',
      name: '15,000 sats',
      value: 15000,
      fromAddress: 'Address3'
    }
  ],
  outputs: [
    { id: 'output-3', name: '9,351 sats', value: 9351, toAddress: 'Address1' },
    { id: 'output-4', name: '5,101 sats', value: 5500, toAddress: 'Address4' }
  ],
  vSize: 490
}
interface TransactionFlowSankeyProps {
  width: number
  height: number
  centerX: number
  centerY: number
  //   pendingTransaction: Transaction
  //   completedTransaction: Transaction
  walletAddress: string
}

// Add this function to identify connecting nodes
const findConnectingNodes = (nodes: any) => {
  const completedOutputs = nodes.filter((node: any) =>
    node.id.startsWith('completed-output')
  )
  const pendingInputs = nodes.filter((node: any) =>
    node.id.startsWith('pending-input')
  )

  return completedOutputs.filter((output: any) =>
    pendingInputs.some((input: any) => input.value === output.value)
  )
}

const TransactionFlowSankey: React.FC<TransactionFlowSankeyProps> = ({
  width,
  height,
  centerX,
  centerY,
  //   pendingTransaction,
  //   completedTransaction,
  walletAddress
}) => {
  const data: SankeyData = useMemo(() => {
    const nodes: NodeData[] = [
      // Completed transaction inputs
      ...completedTransaction.inputs.map((input, index) => ({
        id: `completed-input-${index}`,
        name: input.name,
        value: input.value,
        fromAddress: input.fromAddress,
        children: [`completed-vsize`]
      })),
      // Completed transaction vSize
      {
        id: 'completed-vsize',
        name: `${completedTransaction.vSize} vB`,
        value: completedTransaction.inputs.reduce(
          (acc, input) => acc + input.value,
          0
        ),
        children: completedTransaction.outputs.map(
          (output, index) => `completed-output-${index}`
        )
      },
      // Completed transaction outputs
      ...completedTransaction.outputs.map((output, index) => ({
        id: `completed-output-${index}`,
        name: output.name,
        value: output.value,
        toAddress: output.toAddress,
        children: []
      })),
      // Pending transaction inputs
      ...pendingTransaction.inputs.map((input, index) => ({
        id: `pending-input-${index}`,
        name: input.name,
        value: input.value,
        fromAddress: input.fromAddress,
        children: [`pending-vsize`]
      })),
      // Pending transaction vSize
      {
        id: 'pending-vsize',
        name: `${pendingTransaction.vSize} vB`,
        value: pendingTransaction.inputs.reduce(
          (acc, input) => acc + input.value,
          0
        ),
        children: pendingTransaction.outputs.map(
          (output, index) => `pending-output-${index}`
        )
      },
      // Pending transaction outputs
      ...pendingTransaction.outputs.map((output, index) => ({
        id: `pending-output-${index}`,
        name: output.name,
        value: output.value,
        toAddress: output.toAddress,
        children: []
      }))
    ]

    const links: LinkData[] = [
      // Completed transaction links
      ...completedTransaction.inputs.map((input, index) => ({
        source: `completed-input-${index}`,
        target: 'completed-vsize',
        value: input.value
      })),
      ...completedTransaction.outputs.map((output, index) => ({
        source: 'completed-vsize',
        target: `completed-output-${index}`,
        value: output.value
      })),
      // Link between completed and pending transactions
      {
        source: 'completed-output-0', // Assuming the 9,351 sats output is the first one
        target: 'pending-input-0', // Assuming it's the first input in the pending transaction
        value: 9351
      },
      // Pending transaction links
      ...pendingTransaction.inputs.map((input, index) => ({
        source: `pending-input-${index}`,
        target: 'pending-vsize',
        value: input.value
      })),
      ...pendingTransaction.outputs.map((output, index) => ({
        source: 'pending-vsize',
        target: `pending-output-${index}`,
        value: output.value
      }))
    ]

    return { nodes, links }
  }, [pendingTransaction, completedTransaction, walletAddress])

  const sankeyLayout: any = sankey()
    .nodeWidth(48)
    .nodePadding(80)
    .extent([
      [20, 160],
      [width - 20, height - 160]
    ])
    .nodeId((node: any) => node.id)
    .nodeAlign(sankeyCenter)

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
          {/* Render links */}
          {links?.map((link: any, i: number) => {
            const linkGenerator = sankeyLinkHorizontal()
            const path = linkGenerator(link)

            const isConnectionLink =
              link.source.id === 'completed-output-0' &&
              link.target.id === 'pending-input-0'

            return (
              <Path
                key={i}
                path={path ?? ''}
                color={
                  isConnectionLink
                    ? Colors.warning[500] // Use a distinctive color for the connection
                    : link.source.id.startsWith('completed')
                      ? Colors.gray[600]
                      : Colors.gray[700]
                }
                style="stroke"
                strokeJoin="round"
                strokeWidth={Math.max(1, link.width)}
              />
            )
          })}

          {/* Render nodes */}
          {nodes?.map((node: any) => {
            const isVSize = node.id.includes('vsize')
            const isCompleted = node.id.startsWith('completed')
            const textAlign = node.id.includes('output')
              ? TextAlign.Right
              : TextAlign.Left

            // Check if this node should be hidden
            const connectingNodes = findConnectingNodes(nodes)
            const shouldHideNode = connectingNodes.some(
              (n: any) => n.id === node.id
            )

            if (shouldHideNode) {
              return null // Skip rendering this node
            }

            return (
              <Group key={node.id}>
                {isVSize ? (
                  <Group>
                    <Rect
                      x={node.x0}
                      y={node.y0}
                      width={sankeyLayout.nodeWidth()}
                      height={node.y1 - node.y0}
                      color={isCompleted ? Colors.gray[400] : '#FFF'}
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
                          2
                      }
                      width={sankeyLayout.nodeWidth()}
                    />
                  </Group>
                ) : (
                  <Group>
                    <Paragraph
                      paragraph={nodeParagraph(node.name, textAlign)}
                      x={node.id.includes('output') ? node.x0 - 60 : node.x0}
                      y={
                        node.y0 +
                        (node.y1 - node.y0) / 2 -
                        (nodeParagraph(node.name)?.getHeight() ?? 0) / 2
                      }
                      width={100}
                    />
                    {node.fromAddress && (
                      <Paragraph
                        paragraph={fromParagraph(node.fromAddress)}
                        x={node.x0}
                        y={
                          node.y0 +
                          (node.y1 - node.y0) / 2 +
                          (nodeParagraph(node.name)?.getHeight() ?? 0)
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
