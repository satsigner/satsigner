import { z } from 'zod'

import {
  type Bip329FileType,
  CurrencyValuesSchema,
  type Label,
  LabelSchema,
  LabelTypeSchema
} from '@/types/bips/329'
import type { Account } from '@/types/models/Account'
import type { Address } from '@/types/models/Address'
import type { Transaction } from '@/types/models/Transaction'
import type { Utxo } from '@/types/models/Utxo'

import { type PickFileProps } from './filesystem'
import { isRecord } from './object'
import { getUtxoOutpoint } from './utxo'

export const bip329parser: Record<Bip329FileType, (text: string) => Label[]> = {
  CSV: CSVtoLabels,
  JSON: JSONtoLabels,
  JSONL: JSONLtoLabels
}

export const bip329export: Record<Bip329FileType, (labels: Label[]) => string> =
  {
    CSV: labelsToCSV,
    JSON: labelsToJSON,
    JSONL: labelsToJSONL
  }

export const bip329mimes: Record<Bip329FileType, PickFileProps['type']> = {
  CSV: 'text/csv',
  JSON: 'application/json',
  JSONL: 'text/plain'
}

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

const bip329Alias = new Map<string, keyof Label>()
for (const field of LabelSchema.keyof().options) {
  for (const alias of bip329Aliases[field] ?? []) {
    bip329Alias.set(alias.toLowerCase(), field)
  }
}

const MS_PER_SECOND = 1000

/** Sparrow's "Date (UTC)" CSV cells, e.g. `2025-01-09 14:56:08`. */
const SPARROW_UTC_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

/** An ISO-8601 offset written without a colon, e.g. `+0100`. */
const COMPACT_UTC_OFFSET_PATTERN = /([+-]\d{2})(\d{2})$/

const Bip329NumberSchema = z.union([
  z.number(),
  z.string().trim().min(1).pipe(z.coerce.number())
])

/**
 * Per-field readers that turn BIP-329 values, as other wallets write them,
 * into what LabelSchema expects: CSV cells are strings, and `time` is
 * ISO-8601 in files (with an offset, or local time as BIP-329 allows), a UTC
 * date and time in Sparrow CSVs, and unix seconds in label sync messages
 * (Bitcoin Safe `timestamp`).
 */
const bip329FieldReaders: Record<keyof Label, z.ZodType> = {
  fee: Bip329NumberSchema,
  fmv: CurrencyValuesSchema,
  height: Bip329NumberSchema,
  heights: z.array(z.number()),
  keypath: z.string(),
  label: z.string(),
  origin: z.string(),
  rate: CurrencyValuesSchema,
  ref: z.string(),
  spendable: z.union([z.boolean(), z.stringbool()]),
  time: z
    .union([
      z.date(),
      z
        .string()
        .transform((iso) => iso.replace(COMPACT_UTC_OFFSET_PATTERN, '$1:$2'))
        .pipe(z.iso.datetime({ local: true, offset: true }))
        .transform((iso) => new Date(iso)),
      z
        .string()
        .regex(SPARROW_UTC_DATETIME_PATTERN)
        .transform((utc) => new Date(`${utc.replace(' ', 'T')}Z`)),
      z.number().transform((seconds) => new Date(seconds * MS_PER_SECOND))
    ])
    .pipe(z.date()),
  type: LabelTypeSchema,
  value: Bip329NumberSchema
}

/**
 * Turns one imported record, keyed by Label field, into a Label. Optional
 * fields that cannot be read are dropped so the rest of the record still
 * imports. Returns null for a record to ignore: a type BIP-329 does not
 * define, or no label to store. Throws when type or ref is missing or
 * invalid.
 */
function toLabel(record: Record<string, unknown>): Label | null {
  const hasUnknownType =
    typeof record.type === 'string' &&
    record.type !== '' &&
    !LabelTypeSchema.safeParse(record.type).success
  if (hasUnknownType || typeof record.label !== 'string') {
    return null
  }
  const readable: Record<string, unknown> = {}
  for (const [field, reader] of Object.entries(bip329FieldReaders)) {
    const result = reader.safeParse(record[field])
    if (result.success) {
      readable[field] = result.data
    }
  }
  return LabelSchema.parse(readable)
}

/**
 * Reads one stored label record, such as a label from an app backup where
 * `time` was serialised as a string, into a Label. Null when it is not a
 * usable label; never throws.
 */
export function parseLabelRecord(value: unknown): Label | null {
  if (!isRecord(value)) {
    return null
  }
  try {
    return toLabel(value)
  } catch {
    return null
  }
}

function formatAddressLabels(addresses: Address[]): Label[] {
  return addresses
    .filter((address) => address.label)
    .map((address) => ({
      label: address.label,
      ref: address.address,
      spendable: true,
      type: 'addr'
    }))
}

function formatTransactionLabels(transactions: Transaction[]): Label[] {
  return transactions
    .filter((tx): tx is Transaction & { label: string } => Boolean(tx.label))
    .map((tx) => ({
      label: tx.label,
      ref: tx.id,
      spendable: true,
      type: 'tx' as const
    }))
}

function formatUtxoLabels(utxos: Utxo[]): Label[] {
  return utxos
    .filter((utxo) => utxo.label)
    .map((utxo) => ({
      label: utxo.label!,
      ref: getUtxoOutpoint(utxo),
      spendable: true,
      type: 'output' // TODO: allow the user to mark utxo as not spendable
    }))
}

export function formatAccountLabels(account: Account): Label[] {
  const labelsByRef = new Map<string, Label>()

  if (account.labels) {
    for (const [ref, label] of Object.entries(account.labels)) {
      if (label && label.label) {
        labelsByRef.set(ref, label)
      }
    }
  }

  // Also include labels from transaction/utxo/address objects
  // (in case they have labels not in the dictionary)
  for (const label of formatTransactionLabels(account.transactions)) {
    if (labelsByRef.has(label.ref)) {
      continue
    }
    labelsByRef.set(label.ref, label)
  }
  for (const label of formatUtxoLabels(account.utxos)) {
    if (labelsByRef.has(label.ref)) {
      continue
    }
    labelsByRef.set(label.ref, label)
  }
  for (const label of formatAddressLabels(account.addresses)) {
    if (labelsByRef.has(label.ref)) {
      continue
    }
    labelsByRef.set(label.ref, label)
  }

  return Array.from(labelsByRef.values())
}

function labelsToCSV(labels: Label[]) {
  const CsvHeaderItems: (keyof Label)[] = ['type', 'ref', 'spendable', 'label']
  const CsvHeader = CsvHeaderItems.join(',')
  const CsvRows: string[] = []
  for (const label of labels) {
    const row = []
    for (const column of CsvHeaderItems) {
      row.push(label[column])
    }
    CsvRows.push(row.join(','))
  }
  const Csv = [CsvHeader, ...CsvRows].join('\n')
  return Csv
}

function removeQuotes(str: string) {
  return str.replace(/^['"]/, '').replace(/['"]$/, '')
}

/** One CSV cell: double-quoted (commas allowed, `""` escapes a quote) or plain. */
const CSV_CELL_PATTERN = /(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g

/** Line breaks in exported files, which may use Windows (CRLF) endings. */
const LINE_BREAK_PATTERN = /\r?\n/

/** Splits a CSV row into cells, keeping commas inside double-quoted cells. */
function splitCsvRow(row: string): string[] {
  return Array.from(row.matchAll(CSV_CELL_PATTERN), ([, quoted, plain]) =>
    quoted === undefined ? removeQuotes(plain) : quoted.replaceAll('""', '"')
  )
}

// TODO: refactor this !
export function CSVtoLabels(CsvText: string): Label[] {
  const lines = CsvText.split(LINE_BREAK_PATTERN)
  if (lines.length < 0) {
    throw new Error('Empty CSV text')
  }
  const [header] = lines
  if (!header.match(/^([a-zA-Z()]+,?)+/)) {
    throw new Error('Invalid CSV header')
  }
  const rows = lines.slice(1)
  const labels: Label[] = []
  const columns = header.split(',')
  for (const row of rows) {
    // INFO: SPARROW WALLET uses non-standard CSV files, with empty lines and
    // comment lines. The if statement below ignores those lines in order to
    // correctly parse their non-standard weird CSV export.
    if (row === '' || row.startsWith('#')) {
      continue
    }

    if (!row.match(/^([^,]*,?)+$/)) {
      throw new Error('Invalid CSV line')
    }

    const rowItems = splitCsvRow(row)
    const record: Partial<Record<keyof Label, string>> = {}
    for (const [index, col] of columns.entries()) {
      const column = col.toLowerCase()
      const value = rowItems[index] ?? ''

      // INFO: the following is meant to parse CSV from nunchuk.
      // It assumes the txid was already added to the label ref field.
      if (column === 'vout') {
        record.type = 'addr'
        const txid = record.ref
        const vout = value
        record.ref = `${txid}:${vout}`
        continue
      }

      // INFO: the following is meant to parse CSV from Sparrow.
      if (column === 'output') {
        record.type = 'output'
        record.ref = value
        continue
      }

      if (column === 'address' && record.type === 'output') {
        continue
      }

      if (column === 'txid' && record.type === undefined) {
        record.type = 'tx'
        record.ref = value
        continue
      }

      const field = bip329Alias.get(column)
      if (field === undefined) {
        continue
      }

      record[field] = value
    }
    const label = toLabel(record)
    if (label) {
      labels.push(label)
    }
  }
  return labels
}

function labelsToJSON(labels: Label[]): string {
  return JSON.stringify(labels)
}

function JSONtoLabels(JSONtext: string): Label[] {
  return z
    .array(z.record(z.string(), z.unknown()))
    .parse(JSON.parse(JSONtext))
    .map((record) => toLabel(record))
    .filter((label) => label !== null)
}

export function labelsToJSONL(labels: Label[]): string {
  return labels.map((label) => JSON.stringify(label)).join('\n')
}

function parseJsonlRecord(line: string): Record<string, unknown> {
  const record: unknown = /^{.+}$/.test(line) ? JSON.parse(line) : undefined
  if (!isRecord(record)) {
    throw new Error('Invalid line (JSONL)')
  }
  return record
}

/**
 * Renames the alias keys of a JSONL record (e.g. `txid`, `timestamp`) to
 * their Label field and drops unknown keys. When a record carries both an
 * alias and the canonical key, the alias value wins.
 */
function normalizeAliasKeys(record: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    const field = bip329Alias.get(key.toLowerCase())
    if (field === undefined || (field === key && field in normalized)) {
      continue
    }
    normalized[field] = value
  }
  return normalized
}

export function JSONLtoLabels(JSONLines: string): Label[] {
  const lines = JSONLines.split(LINE_BREAK_PATTERN)
  const labels: Label[] = []
  for (const line of lines) {
    if (line === '') {
      continue
    }
    const label = toLabel(normalizeAliasKeys(parseJsonlRecord(line)))
    if (label) {
      labels.push(label)
    }
  }
  return labels
}
