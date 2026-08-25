import { type Transaction } from '@/types/models/Transaction'
import { groupBy } from '@/utils/array'

import { getDb } from '../connection'
import {
  type TransactionRow,
  type TxInputRow,
  type TxOutputRow,
  rowToTransaction
} from '../mappers'

/**
 * Bulk fetching of parent/child rows.
 *
 * Child tables are read with one query per table per account and grouped in
 * JS, instead of one query per parent row. Ordering clauses keep the per-parent
 * order the mappers rely on when building `vin` / `vout`.
 */

type TxChildRow = { tx_id: string }

function groupChildRowsByTxId<T extends TxChildRow>(
  rows: T[]
): Map<string, T[]> {
  return groupBy(rows, (row) => row.tx_id)
}

function getTxInputsByAccount(accountId: string) {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM tx_inputs WHERE account_id = ? ORDER BY tx_id, input_index',
    [accountId]
  )
  return groupChildRowsByTxId((results ?? []) as (TxInputRow & TxChildRow)[])
}

function getTxOutputsByAccount(accountId: string) {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM tx_outputs WHERE account_id = ? ORDER BY tx_id, output_index',
    [accountId]
  )
  return groupChildRowsByTxId((results ?? []) as (TxOutputRow & TxChildRow)[])
}

/**
 * Hydrate every transaction of an account using 3 queries total, regardless of
 * how many transactions the account has.
 */
function hydrateTransactionRows(
  txRows: TransactionRow[],
  accountId: string
): Transaction[] {
  const inputsByTxId = getTxInputsByAccount(accountId)
  const outputsByTxId = getTxOutputsByAccount(accountId)

  return txRows.map((txRow) =>
    rowToTransaction(
      txRow,
      inputsByTxId.get(txRow.id) ?? [],
      outputsByTxId.get(txRow.id) ?? []
    )
  )
}

type AddressJunctionRow = { address: string; ref: string }

function getAddressJunctions(
  accountId: string,
  table: 'address_transactions' | 'address_utxos',
  refColumn: 'tx_id' | 'utxo_ref'
): Map<string, string[]> {
  const db = getDb()
  const { results } = db.execute(
    `SELECT address, ${refColumn} AS ref FROM ${table} WHERE account_id = ?`,
    [accountId]
  )
  const grouped = groupBy(
    (results ?? []) as AddressJunctionRow[],
    (row) => row.address
  )
  const refsByAddress = new Map<string, string[]>()
  for (const [address, rows] of grouped) {
    refsByAddress.set(
      address,
      rows.map((row) => row.ref)
    )
  }
  return refsByAddress
}

function getAddressTxIdsByAccount(accountId: string) {
  return getAddressJunctions(accountId, 'address_transactions', 'tx_id')
}

function getAddressUtxoRefsByAccount(accountId: string) {
  return getAddressJunctions(accountId, 'address_utxos', 'utxo_ref')
}

export {
  getAddressTxIdsByAccount,
  getAddressUtxoRefsByAccount,
  getTxInputsByAccount,
  getTxOutputsByAccount,
  hydrateTransactionRows
}
