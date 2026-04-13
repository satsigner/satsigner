import { type Transaction } from '@/types/models/Transaction'

import { getDb } from '../connection'
import {
  type TransactionRow,
  type TxInputRow,
  type TxOutputRow,
  rowToTransaction
} from '../mappers'

function getTransactionsByAccount(accountId: string): Transaction[] {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM transactions WHERE account_id = ?',
    [accountId]
  )
  return (results ?? []).map((row) =>
    hydrateTransaction(row as TransactionRow, accountId)
  )
}

function getTransactionById(
  accountId: string,
  txid: string
): Transaction | undefined {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM transactions WHERE id = ? AND account_id = ?',
    [txid, accountId]
  )
  if (!results || results.length === 0) {
    return undefined
  }
  return hydrateTransaction(results[0] as TransactionRow, accountId)
}

function hydrateTransaction(
  row: TransactionRow,
  accountId: string
): Transaction {
  const db = getDb()
  const { results: inputRows } = db.execute(
    'SELECT * FROM tx_inputs WHERE tx_id = ? AND account_id = ? ORDER BY input_index',
    [row.id, accountId]
  )
  const { results: outputRows } = db.execute(
    'SELECT * FROM tx_outputs WHERE tx_id = ? AND account_id = ? ORDER BY output_index',
    [row.id, accountId]
  )
  return rowToTransaction(
    row,
    (inputRows ?? []) as TxInputRow[],
    (outputRows ?? []) as TxOutputRow[]
  )
}

export { getTransactionById, getTransactionsByAccount }
