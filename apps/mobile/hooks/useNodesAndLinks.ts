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
  depthH: number
}

interface UseNodesAndLinksProps {
  transactions: Map<string, Transaction>
  inputs: Map<string, { value: number }>
  outputs: any[]
  utxosSelectedValue: number
  deepLevel: number
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

      const blockDepth = transactions.size * 2 + 1
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
      return [...blockNode, ...outputNodes]
    } else {
      return []
    }
  }, [inputs.size, outputs.length, transactions.size, utxosSelectedValue])

  const outputAddresses = Array.from(transactions.values()).flatMap(
    (tx) => tx.vout?.map((output) => output.scriptpubkey_address) ?? []
  )
  const outputValues = Array.from(transactions.values()).flatMap(
    (tx) => tx.vout?.map((output) => output.value) ?? []
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
  console.log('TX', Array.from(transactions.values()))

  const confirmedNodes: Node[] = useMemo(() => {
    if (transactions.size > 0 && inputs.size > 0) {
      const previousNodes = Array.from(transactions.entries()).flatMap(
        ([, tx], index) => {
          if (!tx.vin || !tx.vout) return []
          console.log('tx index->', index)
          let inputCounter = 0
          let outputCounter = 0
          const allInputNodes = tx.vin
            .map((input, idx) => {
              const depthH = tx.depthH - 1
              console.log('inputCounter->', inputCounter)
              const node = {
                // id: `vin-${depth}-${inputCounter}`,
                id: `vin-${depthH}-${index + idx}`,
                type: 'text',
                depthH,
                textInfo: [
                  `${input.prevout.value}`,
                  `${formatAddress(input.prevout.scriptpubkey_address, 6)}`,
                  ''
                ],
                value: input.prevout.value,
                txId: tx.txid,
                prevout: input.prevout
              }
              inputCounter++
              return node
            })
            .filter((input) => {
              return !(
                outputAddresses.includes(input.prevout.scriptpubkey_address) &&
                outputValues.includes(input.prevout.value)
              )
            })

          console.log(`allinputNodes${index}`, allInputNodes)

          const vsize = Math.ceil(tx.weight * 0.25)
          const blockDepth = tx.depthH

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
            const outputDepth = tx.depthH + 1

            const node = {
              id: `vout-${outputDepth}-${outputCounter}`,
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
            outputCounter++
            return node
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
          id: id.startsWith('block')
            ? `${id}-${depthIndices[depthH]++}`
            : `${id}`,
          depthH,
          ...rest
        }
      })
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
          node.depthH === transactions.size * 2 &&
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

  console.log({ node: allNodes, link: links })

  return { allNodes, links }
}
