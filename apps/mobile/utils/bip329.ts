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

export function labelsToCSV(labels: Label[]) {
  const CsvHeaderItems = ['type', 'ref', 'spendable', 'label']
  const CsvHeader = CsvHeaderItems.join(',')
  const CsvRows = [] as string[]
  for (const label of labels) {
    const row = []
    for (const column of CsvHeaderItems) {
      row.push(label[column as keyof Label])
    }
    CsvRows.push(row.join(','))
  }
  const Csv = [CsvHeader, ...CsvRows].join('\n')
  return Csv
}

export function CSVtoLabels(CsvText: string) {
  const lines = CsvText.split("\n")
  if (lines.length < 0)
    throw new Error('Empty CSV text')
  const header = lines[0]
  const rows = lines.slice(1)
  const labels : Label[] = []
  const columns = header.split(',')
  for (const row of rows) {
    const rowItems = row.split(',')
    const label = {} as Label
    for (const index in columns) {
      const column = columns[index] as keyof Label
      label[column] = rowItems[index] as never
    }
    labels.push(label)
  }
  return labels
}
