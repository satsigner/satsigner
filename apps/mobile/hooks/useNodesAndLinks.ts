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
}

interface Transaction {
  txid: string
  size: number
  weight: number
  vin: {
    prevout: {
      scriptpubkey_address: string
      value: number
    }
  }[]
  vout?: {
    scriptpubkey_address: string
    value: number
  }[]
}

interface UseNodesAndLinksProps {
  transactions: Map<string, Transaction>
  inputs: Map<string, { value: number }>
  outputs: any[]
  utxosSelectedValue: number
  deepLevel: number
}

export function getBlockDepth(size: number, currentIndex: number) {
  const group = Math.floor(currentIndex / size)
  return 1 + 2 * group
}

export const useNodesAndLinks = ({
  transactions,
  inputs,
  outputs,
  utxosSelectedValue,
  deepLevel
}: UseNodesAndLinksProps) => {
  const ingoingNodes = useMemo(() => {
    if (inputs.size > 0) {
      const { size, vsize } = estimateTransactionSize(
        inputs.size,
        outputs.length + 2
      )

      const blockDepth = deepLevel * 2 + 1
      const blockNode = [
        {
          id: `block-${blockDepth}-0`,
          type: 'block',
          depthH: blockDepth,
          value: 0,
          textInfo: ['', '', `${size} B`, `${Math.ceil(vsize)} vB`]
        }
      ]

      const miningFee = `${MINING_FEE_VALUE}`
      const priority = '42 sats/vB'
      const outputNodes = [
        {
          id: `vout-${deepLevel * 2 + 2}-0`,
          type: 'text',
          depthH: deepLevel * 2 + 2,
          textInfo: [
            'Unspent',
            `${utxosSelectedValue - MINING_FEE_VALUE}`,
            'to'
          ],
          value: utxosSelectedValue - MINING_FEE_VALUE
        },
        {
          id: `vout-${deepLevel * 2 + 2}-1`,
          type: 'text',
          depthH: deepLevel * 2 + 2,
          textInfo: [priority, miningFee, 'mining fee'],
          value: MINING_FEE_VALUE
        }
      ]
      return [...blockNode, ...outputNodes]
    } else {
      return []
    }
  }, [deepLevel, inputs.size, outputs.length, utxosSelectedValue])

  const outputAddresses = Array.from(transactions.values()).flatMap(
    (tx) => tx.vout?.map((output) => output.scriptpubkey_address) ?? []
  )

  const incomingAndOutgoingVinTxId = Array.from(transactions.values()).flatMap(
    (tx) =>
      tx.vin
        .filter((input) => {
          return outputAddresses.includes(input.prevout.scriptpubkey_address)
        })
        .map((input) => ({
          txid: `${tx.txid}`,
          prevValue: input.prevout.value
        }))
  )

  const confirmedNodes: Node[] = useMemo(() => {
    if (transactions.size > 0 && inputs.size > 0) {
      const previousNodes = Array.from(transactions.entries()).flatMap(
        ([, tx], index) => {
          if (!tx.vin || !tx.vout) return []

          const allInputNodes = tx.vin
            .filter((input) => {
              return !outputAddresses.includes(
                input.prevout.scriptpubkey_address
              )
            })
            .map((input, idx) => {
              const depth = 0
              return {
                id: `vin-${depth}-${index + idx}`,
                type: 'text',
                depthH: depth,
                textInfo: [
                  `${input.prevout.value}`,
                  `${formatAddress(input.prevout.scriptpubkey_address, 6)}`,
                  ''
                ],
                value: input.prevout.value,
                txId: tx.txid
              }
            })

          const vsize = Math.ceil(tx.weight * 0.25)
          const blockDepth = getBlockDepth(inputs.size, index)

          const blockNode = [
            {
              id: `block-${blockDepth}`,
              type: 'block',
              depthH: blockDepth,
              textInfo: ['', '', `${tx.size} B`, `${vsize} vB`],
              txId: tx.txid
            }
          ]

          const outputNodes = tx.vout.map((output) => {
            const outputDepth = getBlockDepth(inputs.size, index) + 1

            return {
              id: `vout-${outputDepth}`,
              type: 'text',
              depthH: outputDepth,
              textInfo: [
                `${output.value}`,
                `${formatAddress(output.scriptpubkey_address, 6)}`,
                ''
              ],
              value: output.value,
              txId: tx.txid,
              nextTx:
                incomingAndOutgoingVinTxId.find(
                  ({ prevValue }) => prevValue === output.value
                )?.txid ?? ''
            }
          })

          return [...allInputNodes, ...blockNode, ...outputNodes].sort(
            (a, b) => a.depthH - b.depthH
          )
        }
      )

      const depthIndices: { [key: number]: number } = {}
      return previousNodes.map(({ id, depthH, ...rest }) => {
        if (!(depthH in depthIndices)) {
          depthIndices[depthH] = 0
        }

        return {
          id:
            id.startsWith('vout') || id.startsWith('block')
              ? `${id}-${depthIndices[depthH]++}`
              : `${id}`,
          depthH,
          ...rest
        }
      })
    }
    return []
  }, [incomingAndOutgoingVinTxId, inputs.size, outputAddresses, transactions])

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
          const nextDepthNodes = depthMap.get(node.depthH + 1) || []
          const vouts = nextDepthNodes.filter(
            (n: Node) => n.type === 'text' && n.txId === node.txId
          )
          vouts.forEach((vout: Node) => {
            links.push({ source: node.id, target: vout.id, value: vout.value })
          })
        } else if (node.type === 'text' && node.depthH > 0 && node.nextTx) {
          const nextDepthNodes = depthMap.get(node.depthH + 1) || []
          const targetBlock = nextDepthNodes.find(
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
          node.depthH === deepLevel * 2 &&
          Array.from(inputs.values())
            .map((input) => input.value)
            .includes(node?.value ?? 0)
        ) {
          const targetBlock = ingoingNodes[0].id
          if (targetBlock) {
            links.push({
              source: node.id,
              target: targetBlock,
              value: node.value
            })
          }
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
  }, [allNodes?.length, confirmedNodes, deepLevel, ingoingNodes, inputs])

  return { allNodes, links }
}
