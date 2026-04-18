import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { formatDate, formatRelativeTime } from '@/utils/date'
import { formatAddress, formatNumber, formatTxId } from '@/utils/format'
import { estimateTransactionSize } from '@/utils/transaction'

import type { ExtendedTransaction } from './useInputTransactions'

export type TxNode = {
  id: string
  type: string
  depthH: number
  value: number
  txId?: string
  nextTx?: string
  indexV?: number
  vout?: number
  prevout?: { txid: string; vout: number }
  localId?: string
  ioData: {
    address?: string
    label?: string
    value?: number
    fiatValue?: string
    fiatCurrency?: string
    text?: string
    isUnspent?: boolean
    feeRate?: number
    minerFee?: number
    blockTime?: string
    blockHeight?: string
    blockRelativeTime?: string
    txSize?: number
    txId?: number | string
    vSize?: number
    higherFee?: boolean // miner fee is 10% or higher of the total transaction value
    feePercentage?: number // miner fee is 10% or higher of the total transaction value
    isSelfSend?: boolean // NEW: flag for self-send
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
  ownAddresses?: Set<string>
}

export const useNodesAndLinks = ({
  transactions,
  inputs,
  outputs,
  feeRate,
  ownAddresses = new Set()
}: UseNodesAndLinksProps) => {
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const maxExistingDepth =
    transactions.size > 0
      ? Math.max(...Array.from(transactions.values()).map((tx) => tx.depthH))
      : 0
  const outputNodesCurrentTransaction = useMemo(() => {
    if (inputs.size > 0 && transactions.size > 0) {
      const blockDepth = maxExistingDepth + 2

      const { size, vsize } = estimateTransactionSize(
        Array.from(inputs.values()),
        outputs,
        true
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
        depthH: blockDepth + 1,
        id: `vout-${blockDepth + 1}-${index + 1}`,
        indexV: index,
        ioData: {
          address: formatAddress(output.to, 4),
          fiatCurrency,
          fiatValue: formatNumber(satsToFiat(output.amount), 2),
          isSelfSend: ownAddresses.has(output.to),
          isUnspent: true,
          label: output.label,
          text: t('transaction.build.unspent'),
          value: output.amount
        },
        localId: output.localId,
        type: 'text',
        value: output.amount,
        vout: index
      }))

      const remainingBalance = totalInputValue - totalOutputValue - minerFee

      if (remainingBalance > 0) {
        outputNodes.push({
          depthH: blockDepth + 1,
          id: `vout-${blockDepth + 1}-${outputs.length + 1}`,
          indexV: outputs.length,
          ioData: {
            fiatCurrency,
            fiatValue: formatNumber(satsToFiat(remainingBalance), 2),
            isUnspent: true,
            text: t('transaction.build.unspent'),
            value: remainingBalance
          },
          localId: 'remainingBalance',
          type: 'text',
          value: remainingBalance,
          vout: outputs.length
        })
      }

      // Add mining fee node
      // Calculate total output value for outputs with addresses configured
      const totalOutputValueWithAddresses = outputs
        .filter((output) => output.to && output.to.trim() !== '')
        .reduce((sum, output) => sum + output.amount, 0)

      const higherFeeForCurrentTx =
        totalOutputValueWithAddresses > 0
          ? minerFee >= totalOutputValueWithAddresses * 0.1
          : false

      const feePercentageForCurrentTx =
        totalOutputValueWithAddresses > 0
          ? (minerFee / totalOutputValueWithAddresses) * 100
          : 0

      outputNodes.push({
        depthH: blockDepth + 1,
        id: `vout-${blockDepth + 1}-0`,
        indexV: outputs.length + (remainingBalance > 0 ? 1 : 0),
        ioData: {
          feePercentage: Math.round(feePercentageForCurrentTx * 100) / 100,
          feeRate: Math.round(feeRate),
          fiatCurrency,
          fiatValue: formatNumber(satsToFiat(minerFee), 2),
          higherFee: higherFeeForCurrentTx,
          minerFee,
          text: t('transaction.build.minerFee'),
          value: minerFee
        },
        localId: 'current-minerFee',
        type: 'text',
        value: minerFee,
        vout: outputs.length + (remainingBalance > 0 ? 1 : 0)
      })

      return [
        {
          depthH: blockDepth,
          id: `block-${blockDepth}-0`,
          indexV: 0,
          ioData: {
            blockHeight: '',
            blockRelativeTime: '',
            blockTime: '',
            txSize: size,
            vSize: vsize,
            value: totalOutputValue - minerFee
          },
          localId: undefined,
          type: 'block',
          value: totalOutputValue - minerFee
        } as TxNode,
        ...outputNodes
      ]
    }
    return []
  }, [
    inputs,
    transactions.size,
    maxExistingDepth,
    outputs,
    feeRate,
    satsToFiat,
    fiatCurrency,
    ownAddresses
  ])

  const outputAddresses = useMemo(() => {
    if (transactions.size === 0) {
      return []
    }
    return Array.from(transactions.values()).flatMap(
      (tx) => tx.vout?.map((output) => output.address) ?? []
    )
  }, [transactions])

  const outputValues = useMemo(() => {
    if (transactions.size === 0) {
      return []
    }
    return Array.from(transactions.values()).flatMap(
      (tx) => tx.vout?.map((output) => output.value) ?? []
    )
  }, [transactions])

  const incomingAndOutgoingVinTxId = useMemo(
    () =>
      Array.from(transactions.values()).flatMap((tx) =>
        tx.vin.map((input) => ({
          inputTxId: input.previousOutput.txid,
          prevValue: input.value,
          txid: tx.id,
          vout: input.previousOutput.vout
        }))
      ),
    [transactions]
  )

  const previousConfirmedNodes: TxNode[] = useMemo(() => {
    if (transactions.size > 0 && inputs.size > 0) {
      const depthIndices = new Map<number, number>()
      const blockDepthIndices = new Map<number, number>()
      const previousConfirmedNodes = Array.from(transactions.entries()).flatMap(
        ([, tx]) => {
          if (!tx.vin || !tx.vout) {
            return []
          }

          // Calculate total input and output values for *this* transaction
          const totalInputValue = tx.vin.reduce(
            (sum, input) => sum + (input.value ?? 0),
            0
          )
          const totalOutputValue = tx.vout.reduce(
            (sum, output) => sum + (output.value ?? 0),
            0
          )

          // Calculate total output value for outputs with addresses configured
          const totalOutputValueWithAddresses = tx.vout
            .filter((output) => output.address && output.address.trim() !== '')
            .reduce((sum, output) => sum + (output.value ?? 0), 0)

          const minerFee = totalInputValue - totalOutputValue

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
              depthH,
              id: `vin-${depthH}-${currentIndex}`,
              ioData: {
                address: `${formatAddress(input.address, 4)}`,
                fiatCurrency,
                fiatValue: formatNumber(satsToFiat(input.value ?? 0), 2),
                isSelfSend: ownAddresses.has(input.address),
                label: `${input.label ?? ''}`,
                text: t('common.from'),
                txId: tx.id,
                value: input.value ?? 0
              },
              prevout: input.previousOutput,
              txId: tx.id,
              type: 'text',
              value: input.value ?? 0,
              vout: input.previousOutput.vout
            }

            nodes.push(node)
            return nodes
          }, [] as TxNode[])

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
              depthH: blockDepth,
              id: `block-${blockDepth}-${blockIndex}`,
              indexV: blockIndex,
              ioData: {
                blockHeight,
                blockRelativeTime,
                blockTime,
                txId: formatTxId(tx?.id, 6),
                txSize: tx.size,
                vSize: vsize
              },
              txId: tx.id,
              type: 'block',
              value: totalOutputValue
            }
          ]

          const outputNodes = tx.vout.map((output, idx) => {
            const outputDepth = tx.depthH + 1

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
              depthH: outputDepth,
              id: `vout-${outputDepth}-${output.index}`,
              ioData: {
                address: formatAddress(output.address, 4),
                fiatCurrency,
                fiatValue: formatNumber(satsToFiat(output.value ?? 0), 2),
                isSelfSend: ownAddresses.has(output.address),
                label,
                text: t('common.from'),
                value: output.value ?? 0
              },
              localId: undefined,
              nextTx,
              txId: tx.id,
              type: 'text',
              value: output.value ?? 0,
              vout: idx
            }
            return node
          })

          // Create miner fee node if applicable
          const feeNode: TxNode[] = []
          if (minerFee > 0) {
            const feeOutputDepth = tx.depthH + 1
            // Use vout length as index, similar to outputNodesCurrentTransaction fee calculation
            const feeVoutIndex = tx.vout.length
            const minerFeeRate = vsize > 0 ? Math.round(minerFee / vsize) : 0
            const higherFeeForPastTx =
              totalOutputValueWithAddresses > 0
                ? minerFee >= totalOutputValueWithAddresses * 0.1
                : false

            // Calculate fee percentage for past transaction
            const feePercentageForPastTx =
              totalOutputValueWithAddresses > 0
                ? (minerFee / totalOutputValueWithAddresses) * 100
                : 0

            feeNode.push({
              depthH: feeOutputDepth,
              id: `vout-${feeOutputDepth}-fee-${tx.id}`, // Unique ID including txId
              ioData: {
                feePercentage: Math.round(feePercentageForPastTx * 100) / 100,
                feeRate: minerFeeRate,
                fiatCurrency,
                fiatValue: formatNumber(satsToFiat(minerFee), 2),
                higherFee: higherFeeForPastTx,
                minerFee,
                text: t('transaction.build.minerFee'),
                value: minerFee
              },
              localId: `past-minerFee-${tx.id}`,
              txId: tx.id,
              type: 'text',
              value: minerFee,
              vout: feeVoutIndex
            })
          }

          return [
            ...allInputNodes,
            ...blockNode,
            ...outputNodes,
            ...feeNode
          ].toSorted((a, b) => a.depthH - b.depthH)
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
    transactions,
    satsToFiat,
    fiatCurrency,
    ownAddresses
  ])

  const nodes = [
    ...previousConfirmedNodes,
    ...outputNodesCurrentTransaction
  ].toSorted((a, b) => a.depthH - b.depthH)

  const links = useMemo(() => {
    function generateSankeyLinks(nodes: TxNode[]) {
      const links: Link[] = []
      const depthMap = new Map()

      for (const node of nodes) {
        const depth = (node as TxNode).depthH
        if (!depthMap.has(depth)) {
          depthMap.set(depth, [])
        }
        depthMap.get(depth).push(node)
      }

      for (const node of nodes) {
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

          for (const vout of vouts as TxNode[]) {
            links.push({ source: node.id, target: vout.id, value: vout.value })
          }
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
          const targetBlock = outputNodesCurrentTransaction[0].id
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
      }

      for (const node of outputNodesCurrentTransaction.slice(1)) {
        links.push({
          source: outputNodesCurrentTransaction[0].id,
          target: node.id,
          value: node.value ?? 0
        })
      }
      return links
    }

    if (nodes?.length === 0) {
      return []
    }

    return generateSankeyLinks(previousConfirmedNodes)
  }, [
    nodes?.length,
    previousConfirmedNodes,
    outputNodesCurrentTransaction,
    inputs
  ])
  if (transactions.size === 0) {
    return { links: [], nodes: [] }
  }
  return { links, nodes }
}
