import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type Prices } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'

import { type PickFileProps } from './filesystem'
import { getUtxoOutpoint } from './utxo'

export type LabelType = 'tx' | 'addr' | 'pubkey' | 'input' | 'output' | 'xpub'

export type Label = {
  type: LabelType
  ref: string
  label: string
  spendable: boolean

  // optional
  fee?: number
  fmv?: Prices
  height?: number
  heights?: number[]
  keypath?: string
  origin?: string
  rate?: Prices
  time?: Date
  value?: number
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

// These aliases is to handle importing from wallets which do not respect the
// standard names defined in BIP329 but define their own nonsense
const bip329Aliases: Partial<Record<keyof Label, string[]>> = {
  type: ['type'],
  ref: ['ref', 'txid', 'address', 'Payment Address'],
  label: ['label', 'memo'],
  spendable: ['spendable'],

  fee: ['fee', 'Fee sat/vbyte'],
  fmv: ['fmv'],
  height: ['height', 'Block height', 'Blockheight'],
  heights: ['heights', 'Block heights'],
  keypath: ['keypath', 'index'],
  origin: ['origin', 'derivation'],
  rate: ['rate', 'Prices', 'Value (USD)'],
  time: ['date', 'Date (UTC)', 'time', 'timestamp'],
  value: ['value', 'sats', 'satoshis', 'amount']
}

const bip329Alias: Record<string, keyof Label> = {}
for (const key in bip329Aliases) {
  for (const value of bip329Aliases[key as keyof Label] as string[]) {
    bip329Alias[value.toLowerCase()] = key as keyof Label
  }
}

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
        label: utxo.label!,
        type: 'output',
        ref: getUtxoOutpoint(utxo),
        spendable: true // TODO: allow the user to mark utxo as not spendable
      }
    })
}

export function formatAccountLabels(account: Account): Label[] {
  return [
    ...formatTransactionLabels(account.transactions),
    ...formatUtxoLabels(account.utxos),
    ...formatAddressLabels(account.addresses)
  ]
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

function removeQuotes(str: string) {
  return str.replace(/^['"]/, '').replace(/['"]$/, '')
}

// TODO: refactor this !
export function CSVtoLabels(CsvText: string): Label[] {
  const lines = CsvText.split('\n')
  if (lines.length < 0) throw new Error('Empty CSV text')
  const header = lines[0]
  if (!header.match(/^([a-zA-Z()]+,?)+/)) throw new Error('Invalid CSV header')
  const rows = lines.slice(1)
  const labels: Label[] = []
  const columns = header.split(',')
  for (const row of rows) {
    // INFO: SPARROW WALLET uses non-standard CSV files, with empty lines and
    // comment lines. The if statement below ignores those lines in order to
    // correctly parse their non-standard weird CSV export.
    if (row === '' || row.startsWith('#')) continue

    if (!row.match(/^([^,]*,?)+$/)) throw new Error('Invalid CSV line')

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

      if (bip329Alias[column] === undefined) continue

      const field = bip329Alias[column]
      label[field] = value
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
  const lines = JSONLines.split('\n')
  const labels: Label[] = []
  for (const line of lines) {
    if (line === '') continue
    if (!line.match(/^{.+}$/)) throw new Error('Invalid line (JSONL)')
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
