import { useMemo } from 'react'

import { formatAddress } from '@/utils/format'
import { estimateTransactionSize } from '@/utils/transaction'

const MINING_FEE_VALUE = 1635

interface Node {
  id: string
  type: string
  depthH: number
  textInfo: string[]
  value?: number
  txId?: string
  nextTx?: string
  indexH?: number
  prevout?: any
}

interface Transaction {
  txid: string
  size: number
  weight: number
  vin: {
    txid: string
    vout: number
    prevout: {
      scriptpubkey_address: string
      value: number
    }
    indexH?: number
  }[]
  vout?: {
    scriptpubkey_address: string
    value: number
    indexH?: number
  }[]
  depthH: number
}

interface UseNodesAndLinksProps {
  transactions: Map<string, Transaction>
  inputs: Map<string, { value: number }>
  outputs: any[]
  utxosSelectedValue: number
}

export const useNodesAndLinks = ({
  transactions,
  inputs,
  outputs,
  utxosSelectedValue
}: UseNodesAndLinksProps) => {
  const maxExistingDepth =
    transactions.size > 0
      ? Math.max(...Array.from(transactions.values()).map((tx) => tx.depthH))
      : 0
  const ingoingNodes = useMemo(() => {
    if (inputs.size > 0) {
      const blockDepth = maxExistingDepth + 2

      const { size, vsize } = estimateTransactionSize(
        inputs.size,
        outputs.length + 2
      )

      const miningFee = `${MINING_FEE_VALUE}`
      const priority = '42 sats/vB'
      const outputNodes = [
        {
          id: `vout-${blockDepth + 1}-0`,
          type: 'text',
          depthH: blockDepth + 1,
          textInfo: [
            'Unspent',
            `${utxosSelectedValue - MINING_FEE_VALUE}`,
            'to'
          ],
          value: utxosSelectedValue - MINING_FEE_VALUE
        },
        {
          id: `vout-${blockDepth + 1}-1`,
          type: 'text',
          depthH: blockDepth + 1,
          textInfo: [priority, miningFee, 'mining fee'],
          value: MINING_FEE_VALUE
        }
      ]
      return [
        {
          id: `block-${blockDepth}-0`,
          type: 'block',
          depthH: blockDepth,
          value: 0,
          textInfo: ['', '', `${size} B`, `${Math.ceil(vsize)} vB`]
        },
        ...outputNodes
      ]
    } else {
      return []
    }
  }, [inputs.size, maxExistingDepth, outputs.length, utxosSelectedValue])

  const outputAddresses = Array.from(transactions.values()).flatMap(
    (tx) => tx.vout?.map((output) => output.scriptpubkey_address) ?? []
  )
  const outputValues = Array.from(transactions.values()).flatMap(
    (tx) => tx.vout?.map((output) => output.value) ?? []
  )

  const incomingAndOutgoingVinTxId = Array.from(transactions.values()).flatMap(
    (tx) =>
      tx.vin.map((input) => ({
        txid: tx.txid,
        inputTxid: input.txid,
        vout: input.vout,
        prevValue: input.prevout?.value
      }))
  )

  console.log('TX', JSON.stringify(Array.from(transactions.values()), null, 2))

  const confirmedNodes: Node[] = useMemo(() => {
    if (transactions.size > 0 && inputs.size > 0) {
      const depthIndices = new Map<number, number>()
      const blockDepthIndices = new Map<number, number>()
      const previousNodes = Array.from(transactions.entries()).flatMap(
        ([, tx], index) => {
          if (!tx.vin || !tx.vout) return []
          console.log('tx index->', index)

          const allInputNodes = tx.vin.reduce((nodes, input) => {
            // Only process inputs that pass the filter condition
            if (
              outputAddresses.includes(input.prevout.scriptpubkey_address) &&
              outputValues.includes(input.prevout.value)
            ) {
              return nodes
            }

            const depthH = tx.depthH - 1
            // Get current index for this depth and increment it
            const currentIndex = depthIndices.get(depthH) || 0
            depthIndices.set(depthH, currentIndex + 1)

            const node = {
              id: `vin-${depthH}-${currentIndex}`,
              type: 'text',
              depthH,
              textInfo: [
                `${input.prevout.value}`,
                `${formatAddress(input.prevout.scriptpubkey_address, 6)}`,
                ''
              ],
              value: input.prevout.value,
              txId: tx.txid,
              prevout: input.prevout,
              indexH: input.indexH
            }

            nodes.push(node)
            return nodes
          }, [] as any[])

          console.log(`allinputNodes${index}`, allInputNodes)

          const vsize = Math.ceil(tx.weight * 0.25)
          const blockDepth = tx.depthH
          const blockIndex = blockDepthIndices.get(blockDepth) || 0
          blockDepthIndices.set(blockDepth, blockIndex + 1)

          const blockNode = [
            {
              id: `block-${blockDepth}-${blockIndex}`,
              type: 'block',
              depthH: blockDepth,
              textInfo: ['', '', `${tx.size} B`, `${vsize} vB`],
              txId: tx.txid
            }
          ]

          const outputNodes = tx.vout.map((output) => {
            const outputDepth = tx.depthH + 1

            // Find transactions that use this output as an input
            const nextTx =
              incomingAndOutgoingVinTxId.find(
                (vinTx) =>
                  vinTx.inputTxid === tx.txid && vinTx.vout === output.indexH
              )?.txid || ''

            const node = {
              id: `vout-${outputDepth}-${output.indexH}`,
              type: 'text',
              depthH: outputDepth,
              textInfo: [
                `${output.value}`,
                `${formatAddress(output.scriptpubkey_address, 6)}`,
                ''
              ],
              value: output.value,
              txId: tx.txid,
              nextTx,
              indexH: output.indexH
            }
            return node
          })

          return [...allInputNodes, ...blockNode, ...outputNodes].sort(
            (a, b) => a.depthH - b.depthH
          )
        }
      )

      return previousNodes
    }
    return []
  }, [
    incomingAndOutgoingVinTxId,
    inputs.size,
    outputAddresses,
    outputValues,
    transactions
  ])

  const allNodes = [...confirmedNodes, ...ingoingNodes].sort(
    (a, b) => a.depthH - b.depthH
  )

  const links = useMemo(() => {
    function generateSankeyLinks(nodes: Node[]) {
      const links = []
      const depthMap = new Map()

      nodes.forEach((node: Node) => {
        const depth = node.depthH
        if (!depthMap.has(depth)) {
          depthMap.set(depth, [])
        }
        depthMap.get(depth).push(node)
      })

      nodes.forEach((node: Node) => {
        if (node.type === 'text' && node.depthH === 0) {
          // vin node in the first depth
          const nextDepthNodes = depthMap.get(node.depthH + 1) || []
          const targetBlock = nextDepthNodes.find(
            (n: Node) => n.type === 'block' && n.txId === node.txId
          )
          if (targetBlock) {
            links.push({
              source: node.id,
              target: targetBlock.id,
              value: node.value
            })
          }
        } else if (node.type === 'block') {
          // block node
          const nextDepthNodes = depthMap.get(node.depthH + 1) || []
          const vouts = nextDepthNodes.filter(
            (n: Node) => n.type === 'text' && n.txId === node.txId
          )
          vouts.forEach((vout: Node) => {
            links.push({ source: node.id, target: vout.id, value: vout.value })
          })
        } else if (node.type === 'text' && node.nextTx) {
          // vout node that has connection to block
          const targetBlock = nodes.find(
            (n: Node) => n.type === 'block' && n.txId === node.nextTx
          )
          if (targetBlock) {
            links.push({
              source: node.id,
              target: targetBlock.id,
              value: node.value
            })
          }
        } else if (
          node.type === 'text' &&
          node.id.includes('vout') &&
          Array.from(inputs.values())
            .map((input) => input.value)
            .includes(node?.value ?? 0)
        ) {
          // vout node that has input selected by users - now works with any depthH
          const targetBlock = ingoingNodes[0].id
          if (targetBlock) {
            links.push({
              source: node.id,
              target: targetBlock,
              value: node.value
            })
          }
        } else if (
          node.type === 'text' &&
          node.depthH !== 0 &&
          node.id.includes('vin')
        ) {
          console.log('ViN', node)

          const nextDepthNodes = depthMap.get(node.depthH + 1) || []
          const targetBlock = nextDepthNodes.find(
            (n: Node) => n.type === 'block' && n.txId === node.txId
          )
          links.push({
            source: node.id,
            target: targetBlock,
            value: node.value
          })
        }
      })
      links.push({
        source: ingoingNodes[0].id,
        target: ingoingNodes[1].id,
        value: ingoingNodes[1]?.value ?? 0
      })

      links.push({
        source: ingoingNodes[0].id,
        target: ingoingNodes[2].id,
        value: ingoingNodes[2]?.value ?? 0
      })
      return links
    }
    if (allNodes?.length === 0) return []

    return generateSankeyLinks(confirmedNodes)
  }, [allNodes?.length, confirmedNodes, ingoingNodes, inputs])

  console.log({ node: allNodes, link: links })

  return { nodes: allNodes, links }
}
