import { useMemo } from 'react'

import { t } from '@/locales'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { formatDate, formatRelativeTime } from '@/utils/date'
import { formatAddress, formatTxId } from '@/utils/format'
import { estimateTransactionSize } from '@/utils/transaction'

import type { ExtendedTransaction } from './useInputTransactions'

export interface TxNode {
  localId?: string
  id: string
  type: string
  depthH: number
  value?: number
  txId?: string
  nextTx?: string
  indexV?: number
  vout?: number
  prevout?: any
  ioData: {
    label?: string
    feeRate?: number
    address?: string
    minerFee?: number
    text?: string
    blockTime?: string
    blockHeight?: string
    blockRelativeTime?: string
    txSize?: number
    txId?: number
    vSize?: number
    isUnspent?: boolean
    value: number
  }
}

type Link = {
  source: string
  target: string
  value: number | undefined
}

// type Transaction = {
//   txid: string
//   size: number
//   weight: number
//   vin: {
//     txid: string
//     vout: number
//     prevout: {
//       scriptpubkey_address: string
//       value: number
//     }
//     indexV?: number
//     label?: string
//   }[]
//   vout?: {
//     scriptpubkey_address: string
//     value: number
//     indexV?: number
//     vout?: number
//   }[]
//   depthH: number
//   status: { block_height?: number; block_time?: number }
// }

type UseNodesAndLinksProps = {
  transactions: Map<string, ExtendedTransaction>
  inputs: Map<string, Utxo>
  outputs: Output[]
  feeRate: number
}

export const useNodesAndLinks = ({
  transactions,
  inputs,
  outputs,
  feeRate
}: UseNodesAndLinksProps) => {
  // Ensure all transaction outputs have the vout property set
  // Array.from(transactions.values()).forEach((tx) => {
  //   if (tx.vout) {
  //     tx.vout.forEach((output, idx) => {
  //       if (output.vout === undefined) {
  //         output.vout = idx
  //       }
  //       if (output.indexV === undefined) {
  //         output.indexV = idx
  //       }
  //     })
  //   }
  // })

  const maxExistingDepth =
    transactions.size > 0
      ? Math.max(...Array.from(transactions.values()).map((tx) => tx.depthH))
      : 0
  const ingoingNodes = useMemo(() => {
    if (inputs.size > 0) {
      const blockDepth = maxExistingDepth + 2

      const { size, vsize } = estimateTransactionSize(
        inputs.size,
        outputs.length + 1
      )
      const minerFee = Math.round(feeRate * vsize)

      // Calculate total input value
      const totalInputValue = Array.from(inputs.values()).reduce(
        (sum, input) => sum + input.value,
        0
      )

      // Calculate total output value
      const totalOutputValue = outputs.reduce(
        (sum, output) => sum + output.amount,
        0
      )

      // Create output nodes
      let outputNodes: TxNode[] = []

      outputNodes = outputs.map((output, index) => ({
        id: `vout-${blockDepth + 1}-${index + 1}`,
        localId: output.localId,
        type: 'text',
        depthH: blockDepth + 1,
        ioData: {
          isUnspent: true,
          label: output.label,
          address: formatAddress(output.to, 4),
          text: t('transaction.build.unspent'),
          value: output.amount
        },
        value: output.amount,
        indexV: index,
        vout: index
      }))

      const remainingBalance = totalInputValue - totalOutputValue - minerFee

      if (remainingBalance > 0) {
        outputNodes.push({
          id: `vout-${blockDepth + 1}-${outputs.length + 1}`,
          type: 'text',
          depthH: blockDepth + 1,
          ioData: {
            value: remainingBalance,
            text: t('transaction.build.unspent'),
            isUnspent: true
          },
          value: remainingBalance,
          indexV: outputs.length,
          vout: outputs.length,
          localId: 'remainingBalance'
        })
      }

      // Add mining fee node
      outputNodes.push({
        id: `vout-${blockDepth + 1}-0}`,
        type: 'text',
        depthH: blockDepth + 1,
        value: minerFee,
        ioData: {
          feeRate: Math.round(feeRate),
          minerFee,
          text: t('transaction.build.minerFee'),
          value: minerFee
        },
        indexV: outputs.length + (remainingBalance > 0 ? 1 : 0),
        vout: outputs.length + (remainingBalance > 0 ? 1 : 0),
        localId: 'minerFee'
      })

      return [
        {
          localId: undefined,
          id: `block-${blockDepth}-0`,
          type: 'block',
          depthH: blockDepth,
          value: totalOutputValue - minerFee,
          ioData: {
            blockHeight: '',
            blockRelativeTime: '',
            blockTime: '',
            txSize: size,
            vSize: vsize,
            value: totalOutputValue - minerFee
          },
          indexV: 0
        } as TxNode,
        ...outputNodes
      ]
    } else {
      return []
    }
  }, [inputs, maxExistingDepth, outputs, feeRate])

  const outputAddresses = Array.from(transactions.values()).flatMap(
    (tx) => tx.vout?.map((output) => output.address) ?? []
  )
  const outputValues = Array.from(transactions.values()).flatMap(
    (tx) => tx.vout?.map((output) => output.value) ?? []
  )

  const incomingAndOutgoingVinTxId = Array.from(transactions.values()).flatMap(
    (tx) =>
      tx.vin.map((input) => ({
        txid: tx.id,
        inputTxId: input.previousOutput.txid,
        vout: input.previousOutput.vout,
        prevValue: input.value
      }))
  )

  const previousConfirmedNodes: TxNode[] = useMemo(() => {
    if (transactions.size > 0 && inputs.size > 0) {
      const depthIndices = new Map<number, number>()
      const blockDepthIndices = new Map<number, number>()
      const previousConfirmedNodes = Array.from(transactions.entries()).flatMap(
        ([, tx]) => {
          if (!tx.vin || !tx.vout) return []

          const allInputNodes = tx.vin.reduce((nodes, input) => {
            // Only process inputs that pass the filter condition
            if (
              outputAddresses.includes(input.address) &&
              outputValues.includes(input.value ?? 0)
            ) {
              return nodes
            }

            const depthH = tx.depthH - 1
            // Get current index for this depth and increment it
            const currentIndex = depthIndices.get(depthH) || 0
            depthIndices.set(depthH, currentIndex + 1)

            // // Set the indexV property if not already set
            // if (input.indexV === undefined) {
            //   input.indexV = currentIndex
            // }

            const node = {
              id: `vin-${depthH}-${currentIndex}`,
              type: 'text',
              depthH,
              ioData: {
                value: input.value,
                address: `${formatAddress(input.address, 4)}`,
                label: `${input.label ?? ''}`,
                txId: tx.id,
                text: t('common.from')
              },
              value: input.value,
              txId: tx.id,
              prevout: input.previousOutput,
              vout: input.previousOutput.vout
            }

            nodes.push(node)
            return nodes
          }, [] as any[])

          const vsize = Math.ceil((tx?.weight ?? 0) * 0.25)
          const blockDepth = tx.depthH
          const blockIndex = blockDepthIndices.get(blockDepth) || 0
          const blockHeight = `${tx.blockHeight}`
          const blockRelativeTime = formatRelativeTime(
            tx.timestamp?.getTime() ?? 0
          )
          const blockTime = formatDate(tx.timestamp?.getTime() ?? 0)

          blockDepthIndices.set(blockDepth, blockIndex + 1)
          const blockNode = [
            {
              id: `block-${blockDepth}-${blockIndex}`,
              type: 'block',
              depthH: blockDepth,
              ioData: {
                blockTime,
                blockHeight,
                blockRelativeTime,
                txSize: tx.size,
                vSize: vsize,
                txId: formatTxId(tx?.id, 6)
              },
              txId: tx.id,
              indexV: blockIndex
            }
          ]

          const outputNodes = tx.vout.map((output, idx) => {
            const outputDepth = tx.depthH + 1

            // // Set the vout property to the array index if not already set
            // if (output.vout === undefined) {
            //   output.vout = idx
            // }

            // Find transactions that use this output as an input
            const nextTx =
              incomingAndOutgoingVinTxId.find(
                (vinTx) =>
                  vinTx.inputTxId === tx.id &&
                  vinTx.vout === idx &&
                  vinTx.prevValue === output.value
              )?.txid || ''

            const label =
              Array.from(inputs.values()).find(
                (input) =>
                  input.vout === idx &&
                  input.value === output.value &&
                  input.addressTo === output.address
              )?.label ?? ''

            const node = {
              localId: undefined,
              id: `vout-${outputDepth}-${output.index}`,
              type: 'text',
              depthH: outputDepth,
              ioData: {
                label,
                address: formatAddress(output.address, 4),
                value: output.value,
                text: t('common.from')
              },
              value: output.value,
              txId: tx.id,
              nextTx,
              vout: idx
            }
            return node
          })

          return [...allInputNodes, ...blockNode, ...outputNodes].sort(
            (a, b) => a.depthH - b.depthH
          )
        }
      )

      return previousConfirmedNodes
    }
    return []
  }, [
    incomingAndOutgoingVinTxId,
    inputs,
    outputAddresses,
    outputValues,
    transactions
  ])

  const nodes = [...previousConfirmedNodes, ...ingoingNodes].sort(
    (a, b) => a.depthH - b.depthH
  )

  const links = useMemo(() => {
    function generateSankeyLinks(nodes: TxNode[]) {
      const links: Link[] = []
      const depthMap = new Map()

      nodes.forEach((node: TxNode) => {
        const depth = node.depthH
        if (!depthMap.has(depth)) {
          depthMap.set(depth, [])
        }
        depthMap.get(depth).push(node)
      })

      nodes.forEach((node: TxNode) => {
        if (node.type === 'text' && node.depthH === 0) {
          // vin node in the first depth
          const nextDepthNodes = depthMap.get(node.depthH + 1) || []
          const targetBlock = nextDepthNodes.find(
            (n: TxNode) => n.type === 'block' && n.txId === node.txId
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
            (n: TxNode) => n.type === 'text' && n.txId === node.txId
          )

          vouts.forEach((vout: TxNode) => {
            console.log(
              JSON.stringify({ source: node.id, target: vout.id }, null, 2)
            )
            links.push({ source: node.id, target: vout.id, value: vout.value })
          })
        } else if (node.type === 'text' && node.nextTx) {
          // vout node that has connection to block
          const targetBlock = nodes.find(
            (n: TxNode) => n.type === 'block' && n.txId === node.nextTx
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
            .includes(node?.value ?? 0) &&
          Array.from(inputs.values())
            .map((input) => input.vout)
            .includes(node?.vout ?? 0)
        ) {
          // vout node that has input selected by users
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
          const nextDepthNodes = depthMap.get(node.depthH + 1) || []
          const targetBlock = nextDepthNodes.find(
            (n: TxNode) => n.type === 'block' && n.txId === node.txId
          )
          links.push({
            source: node.id,
            target: targetBlock,
            value: node.value
          })
        }
      })

      ingoingNodes.slice(1).map((node) => {
        links.push({
          source: ingoingNodes[0].id,
          target: node.id,
          value: node.value ?? 0
        })
      })
      return links
    }

    if (nodes?.length === 0) return []

    return generateSankeyLinks(previousConfirmedNodes)
  }, [nodes?.length, previousConfirmedNodes, ingoingNodes, inputs])
  // console.log(JSON.stringify({ nodes }, null, 2))
  return { nodes, links }
}
