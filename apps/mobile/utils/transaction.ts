import { type Utxo } from '@/types/models/Utxo'
import { formatAddress } from '@/utils/format'

const MINING_FEE_VALUE = 1635

type TransactionNode = {
  id: string
  indexC: number
  type: 'text' | 'block'
  depthH: number
  textInfo: string[]
  value?: number
}

export function createTransactionNodes(
  inputs: Map<string, Utxo>,
  utxosSelectedValue: number,
  transactionFee: string,
  feeRate: number,
  outputTo: string
): TransactionNode[] {
  if (inputs.size === 0) return []

  const inputNodes: TransactionNode[] = Array.from(inputs.entries()).map(
    ([, input], index) => ({
      id: String(index + 1),
      indexC: index + 1,
      type: 'text',
      depthH: 1,
      textInfo: [
        `${input.value}`,
        `${formatAddress(input.txid, 3)}`,
        input.label ?? ''
      ],
      value: input.value
    })
  )

  const blockNode: TransactionNode[] = [
    {
      id: String(inputs.size + 1),
      indexC: inputs.size + 1,
      type: 'block',
      depthH: 2,
      textInfo: ['', '', '1533 B', '1509 vB']
    }
  ]

  const miningFee = `${Number(transactionFee)}`
  const priority = `${feeRate} sats/vB`
  const outputNodes: TransactionNode[] = [
    {
      id: String(inputs.size + 2),
      indexC: inputs.size + 2,
      type: 'text',
      depthH: 3,
      textInfo: [
        'Unspent',
        `${utxosSelectedValue - Number(transactionFee)}`,
        `to ${formatAddress(outputTo, 5)}`
      ],
      value: utxosSelectedValue - Number(transactionFee)
    },
    {
      id: String(inputs.size + 3),
      indexC: inputs.size + 3,
      type: 'text',
      depthH: 3,
      textInfo: [priority, miningFee, 'mining fee'],
      value: MINING_FEE_VALUE
    }
  ]

  return [...inputNodes, ...blockNode, ...outputNodes]
}
