import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'

import { getUtxoOutpoint } from './utxo'

export type LabelType = 'tx' | 'addr' | 'pubkey' | 'input' | 'output' | 'xpub'

export type Label = {
  type: LabelType
  ref: string
  label: string
  origin?: string
  spendable: boolean
}

export function formatTransactionLabels(transactions: Transaction[]): Label[] {
  const labels: Label[] = []

  for (const tx of transactions) {
    if (!tx.label) continue

    labels.push({
      label: tx.label,
      type: 'tx',
      ref: tx.id,
      spendable: true
    })
  }

  return labels
}

export function formatUtxoLabels(utxos: Utxo[]) {
  const labels: Label[] = []

  for (const utxo of utxos) {
    if (!utxo.label) continue

    labels.push({
      label: utxo.label,
      type: 'output',
      ref: getUtxoOutpoint(utxo),
      spendable: true // TODO: allow the user to mark utxo as not spendable
    })
  }

  return labels
}
