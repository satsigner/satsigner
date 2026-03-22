import type { Account } from '@/types/models/Account'
import type { Address } from '@/types/models/Address'
import type { Prices } from '@/types/models/Blockchain'
import type { Transaction } from '@/types/models/Transaction'
import type { Utxo } from '@/types/models/Utxo'

import type { PickFileProps } from './filesystem'
import { getUtxoOutpoint } from './utxo'

type LabelType = 'tx' | 'addr' | 'pubkey' | 'input' | 'output' | 'xpub'

export interface Label {
  type: LabelType
  ref: string
  label: string

  // optional
  fee?: number
  fmv?: Prices
  height?: number
  heights?: number[]
  keypath?: string
  origin?: string
  rate?: Prices
  spendable?: boolean
  time?: Date
  value?: number
}

export type Bip329FileType = 'JSONL' | 'JSON' | 'CSV'

export const bip329FileTypes: Bip329FileType[] = ['JSONL', 'JSON', 'CSV']

export const bip329parser = {
  CSV: CSVtoLabels,
  JSON: JSONtoLabels,
  JSONL: JSONLtoLabels
} as Record<Bip329FileType, (text: string) => Label[]>

export const bip329export = {
  CSV: labelsToCSV,
  JSON: labelsToJSON,
  JSONL: labelsToJSONL
} as Record<Bip329FileType, (labels: Label[]) => string>

export const bip329mimes = {
  CSV: 'text/csv',
  JSON: 'application/json',
  JSONL: 'text/plain'
} as Record<Bip329FileType, PickFileProps['type']>

// These aliases is to handle importing from wallets which do not respect the
// standard names defined in BIP329 but define their own nonsense
const bip329Aliases: Partial<Record<keyof Label, string[]>> = {
  fee: ['fee', 'Fee sat/vbyte'],
  fmv: ['fmv'],
  height: ['height', 'Block height', 'Blockheight'],
  heights: ['heights', 'Block heights'],

  keypath: ['keypath', 'index'],
  label: ['label', 'memo'],
  origin: ['origin', 'derivation'],
  rate: ['rate', 'Prices', 'Value (USD)'],
  ref: ['ref', 'txid', 'address', 'Payment Address'],
  spendable: ['spendable'],
  time: ['date', 'Date (UTC)', 'time', 'timestamp'],
  type: ['type'],
  value: ['value', 'sats', 'satoshis', 'amount']
}

const bip329Alias: Record<string, keyof Label> = {}
for (const key in bip329Aliases) {
  for (const value of bip329Aliases[key as keyof Label] as string[]) {
    bip329Alias[value.toLowerCase()] = key as keyof Label
  }
}

function formatAddressLabels(addresses: Address[]): Label[] {
  return addresses
    .filter((address) => address.label)
    .map((address) => ({
        label: address.label,
        type: 'addr',
        ref: address.address,
        spendable: true
      }))
}

function formatTransactionLabels(transactions: Transaction[]): Label[] {
  return transactions
    .filter((tx) => tx.label)
    .map((tx) => ({
        label: tx.label,
        type: 'tx',
        ref: tx.id,
        spendable: true
      }))
}

function formatUtxoLabels(utxos: Utxo[]): Label[] {
  return utxos
    .filter((utxo) => utxo.label)
    .map((utxo) => ({
        label: utxo.label!,
        type: 'output',
        ref: getUtxoOutpoint(utxo),
        spendable: true // TODO: allow the user to mark utxo as not spendable
      }))
}

export function formatAccountLabels(account: Account): Label[] {
  // Start with labels from the dictionary (source of truth)
  const labelsByRef = new Map<string, Label>()

  // Add all labels from the account.labels dictionary
  if (account.labels) {
    for (const ref in account.labels) {
      const label = account.labels[ref]
      if (label && label.label) {
        labelsByRef.set(ref, label)
      }
    }
  }

  // Also include labels from transaction/utxo/address objects
  // (in case they have labels not in the dictionary)
  for (const label of formatTransactionLabels(account.transactions)) {
    if (!labelsByRef.has(label.ref)) {
      labelsByRef.set(label.ref, label)
    }
  }
  for (const label of formatUtxoLabels(account.utxos)) {
    if (!labelsByRef.has(label.ref)) {
      labelsByRef.set(label.ref, label)
    }
  }
  for (const label of formatAddressLabels(account.addresses)) {
    if (!labelsByRef.has(label.ref)) {
      labelsByRef.set(label.ref, label)
    }
  }

  return [...labelsByRef.values()]
}

function labelsToCSV(labels: Label[]) {
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

function removeQuotes(str: string) {
  return str.replace(/^['"]/, '').replace(/['"]$/, '')
}

// TODO: refactor this !
export function CSVtoLabels(CsvText: string): Label[] {
  const lines = CsvText.split('\n')
  if (lines.length < 0) {throw new Error('Empty CSV text')}
  const header = lines[0]
  if (!/^([a-zA-Z()]+,?)+/.test(header)) {throw new Error('Invalid CSV header')}
  const rows = lines.slice(1)
  const labels: Label[] = []
  const columns = header.split(',')
  for (const row of rows) {
    // INFO: SPARROW WALLET uses non-standard CSV files, with empty lines and
    // comment lines. The if statement below ignores those lines in order to
    // correctly parse their non-standard weird CSV export.
    if (row === '' || row.startsWith('#')) {continue}

    if (!/^([^,]*,?)+$/.test(row)) {throw new Error('Invalid CSV line')}

    const rowItems = row.split(',')
    const label = {} as Label
    for (const index in columns) {
      const column = columns[index].toLowerCase()
      const value = removeQuotes(rowItems[index]) as never

      // INFO: the following is meant to parse CSV from nunchuk.
      // It assumes the txid was already added to the label ref field.
      if (column === 'vout') {
        label.type = 'addr'
        const txid = label.ref
        const vout = value
        label.ref = `${txid}:${vout}`
        continue
      }

      // INFO: the following is meant to parse CSV from Sparrow.
      if (column === 'output') {
        label.type = 'output'
        label.ref = value
        continue
      }

      if (column === 'address' && label.type === 'output') {
        continue
      }

      if (column === 'txid' && label.type === undefined) {
        label.type = 'tx'
        label.ref = value
        continue
      }

      if (bip329Alias[column] === undefined) {continue}

      const field = bip329Alias[column]
      label[field] = value
    }
    labels.push(label)
  }
  return labels
}

function labelsToJSON(labels: Label[]): string {
  return JSON.stringify(labels)
}

function JSONtoLabels(JSONtext: string): Label[] {
  return JSON.parse(JSONtext) as Label[]
}

export function labelsToJSONL(labels: Label[]): string {
  return labels.map((label) => JSON.stringify(label)).join('\n')
}

export function JSONLtoLabels(JSONLines: string): Label[] {
  const lines = JSONLines.split('\n')
  const labels: Label[] = []
  for (const line of lines) {
    if (line === '') {continue}
    if (!/^{.+}$/.test(line)) {throw new Error('Invalid line (JSONL)')}
    const obj = JSON.parse(line)
    for (const key in obj) {
      const aliasKey = key.toLowerCase()
      if (bip329Alias[aliasKey] !== undefined) {
        const field = bip329Alias[aliasKey]
        if (field === key) {
          continue
        }
        const value = obj[key]
        obj[field] = value
      }
      delete obj[key]
    }
    labels.push(obj as Label)
  }
  return labels
}
