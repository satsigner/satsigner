import { type Transaction } from '@/types/models/Transaction'

import { getDb } from '../connection'
import {
  type TransactionRow,
  type TxInputRow,
  type TxOutputRow,
  rowToTransaction
} from '../mappers'
import { hydrateTransactionRows } from './children'

function getTransactionsByAccount(accountId: string): Transaction[] {
  const db = getDb()
  const { rows } = db.execute<TransactionRow>(
    'SELECT * FROM transactions WHERE account_id = ?',
    [accountId]
  )
  return hydrateTransactionRows(rows._array, accountId)
}

function getTransactionById(
  accountId: string,
  txid: string
): Transaction | undefined {
  const db = getDb()
  const row = db
    .execute<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ? AND account_id = ?',
      [txid, accountId]
    )
    .rows.item(0)
  if (!row) {
    return undefined
  }
  return hydrateTransaction(row, accountId)
}

function hydrateTransaction(
  row: TransactionRow,
  accountId: string
): Transaction {
  const db = getDb()
  const { rows: inputRows } = db.execute<TxInputRow>(
    'SELECT * FROM tx_inputs WHERE tx_id = ? AND account_id = ? ORDER BY input_index',
    [row.id, accountId]
  )
  const { rows: outputRows } = db.execute<TxOutputRow>(
    'SELECT * FROM tx_outputs WHERE tx_id = ? AND account_id = ? ORDER BY output_index',
    [row.id, accountId]
  )
  return rowToTransaction(row, inputRows._array, outputRows._array)
}

export { getTransactionById, getTransactionsByAccount }
