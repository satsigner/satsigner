import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { formatLabel } from './format'
import { getUtxoOutpoint } from './utxo'

export type LabelType = "tx" | "addr" | "pubkey" | "input" | "output" | "xpub"

export type Label = {
  type: LabelType
  ref: string
  label: string
  origin?: string
  spendable: boolean
}

/**
 * We are using specific format to store labels in our application:
 *
 * ```
 * My label tags:tag1,tag2,tag3
 * ```
 *
 * But we will export it to another format:
 *
 * ```
 * My label #tag1 #tag2 #tag3
 * ```
 *
 * @param {string} label
 * @return {string}
 */
function formatRawLabel(label: string): string {
  const parsedLabel = formatLabel(label)
  return (parsedLabel.tags.length === 0) ?
    parsedLabel.label :
    parsedLabel.label + ' ' + parsedLabel.tags.map(tag => '#' + tag).join(' ')
}

export function formatTransactionLabels(transactions: Transaction[]): Label[] {
  const labels : Label[] = []

  for (const tx of transactions) {
    if (!tx.label) continue

    labels.push({
      label: formatRawLabel(tx.label),
      type: "tx",
      ref: tx.id,
      spendable: true
    })
  }

  return labels
}

export function formatUtxoLabels(utxos: Utxo[]) {
  const labels : Label[] = []

  for (const utxo of utxos) {
    if (!utxo.label) continue

    labels.push({
      label: formatRawLabel(utxo.label),
      type: "output",
      ref: getUtxoOutpoint(utxo),
      spendable: true // TODO: allow the user to mark utxo as not spendable
    })
  }

  return labels
}
