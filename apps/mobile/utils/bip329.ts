import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'

import { type PickFileProps } from './filesystem'
import { getUtxoOutpoint } from './utxo'
import { Address } from '@/types/models/Address'

export type LabelType = 'tx' | 'addr' | 'pubkey' | 'input' | 'output' | 'xpub'

export type Label = {
  type: LabelType
  ref: string
  label: string
  origin?: string
  spendable: boolean
}

export type Bip329FileType = 'JSONL' | 'JSON' | 'CSV'

export const bip329FileTypes: Bip329FileType[] = ['JSONL', 'JSON', 'CSV']

export const bip329parser = {
  JSON: JSONtoLabels,
  JSONL: JSONLtoLabels,
  CSV: CSVtoLabels
} as Record<Bip329FileType, (text: string) => Label[]>

export const bip329export = {
  JSON: labelsToJSON,
  JSONL: labelsToJSONL,
  CSV: labelsToCSV
} as Record<Bip329FileType, (labels: Label[]) => string>

export const bip329mimes = {
  JSON: 'application/json',
  JSONL: 'text/plain',
  CSV: 'text/csv'
} as Record<Bip329FileType, PickFileProps['type']>

export function formatAddressLabels(addresses: Address[]): Label[] {
  return addresses
    .filter((address) => address.label)
    .map((address) => {
      return {
        label: address.label,
        type: 'addr',
        ref: address.address,
        spendable: true
      } as Label
    })
}

export function formatTransactionLabels(transactions: Transaction[]): Label[] {
  return transactions
    .filter((tx) => tx.label)
    .map((tx) => {
      return {
        label: tx.label,
        type: 'tx',
        ref: tx.id,
        spendable: true
      } as Label
    })
}

export function formatUtxoLabels(utxos: Utxo[]): Label[] {
  return utxos
    .filter((utxo) => utxo.label)
    .map((utxo) => {
      return {
        label: utxo.label,
        type: 'output',
        ref: getUtxoOutpoint(utxo),
        spendable: true // TODO: allow the user to mark utxo as not spendable
      }
    })
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

export function CSVtoLabels(CsvText: string): Label[] {
  const lines = CsvText.split('\n')
  if (lines.length < 0) throw new Error('Empty CSV text')
  const header = lines[0]
  if (!header.match(/^([a-z]+,?)+/)) throw new Error('Invalid CSV header')
  const rows = lines.slice(1)
  const labels: Label[] = []
  const columns = header.split(',')
  for (const row of rows) {
    if (!row.match(/^([^,]*,?)+$/)) throw new Error('Invalid CSV line')
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

export function labelsToJSON(labels: Label[]): string {
  return JSON.stringify(labels)
}

export function JSONtoLabels(JSONtext: string): Label[] {
  return JSON.parse(JSONtext) as Label[]
}

export function labelsToJSONL(labels: Label[]): string {
  return labels.map((label) => JSON.stringify(label)).join('\n')
}

export function JSONLtoLabels(JSONLines: string): Label[] {
  return JSONLines.split('\n').map((line) => {
    if (!line.match(/^{[^}]+}$/)) throw new Error('Invalid line (JSONL)')
    return JSON.parse(line) as Label
  })
}
