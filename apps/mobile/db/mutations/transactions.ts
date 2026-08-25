import {
  type NitroSQLiteConnection,
  type SQLiteValue
} from 'react-native-nitro-sqlite'

import { type Transaction } from '@/types/models/Transaction'

import { bulkInsert } from '../bulkInsert'
import { runTransaction } from '../connection'
import { dateToIso, optionalToJson } from '../mappers'

type TransactionContext = NitroSQLiteConnection

const TRANSACTIONS_INSERT = `INSERT OR REPLACE INTO transactions (
  id, account_id, type, sent, received, timestamp, block_height,
  address, label, fee, size, vsize, weight, version,
  lock_time, lock_time_enabled, raw, prices
)`
const TRANSACTIONS_COLUMNS = 18

const TX_INPUTS_INSERT = `INSERT INTO tx_inputs (
  tx_id, account_id, input_index, prev_txid, prev_vout,
  sequence, script_sig, witness, value, label
)`
const TX_INPUTS_COLUMNS = 10

const TX_OUTPUTS_INSERT = `INSERT INTO tx_outputs (
  tx_id, account_id, output_index, value, address, script, label
)`
const TX_OUTPUTS_COLUMNS = 7

function upsertTransactions(
  tx: TransactionContext,
  accountId: string,
  transactions: Transaction[]
) {
  if (transactions.length === 0) {
    return
  }

  // Batched inserts put every vin/vout of the array in one statement, so a
  // repeated transaction id would collide on UNIQUE (tx_id, account_id, index).
  // Keeping the last entry per id matches the previous row-by-row behaviour,
  // where a later duplicate overwrote the earlier one.
  const deduped = [...new Map(transactions.map((t) => [t.id, t])).values()]

  const txRows: SQLiteValue[][] = []
  const inputRows: SQLiteValue[][] = []
  const outputRows: SQLiteValue[][] = []

  for (const t of deduped) {
    txRows.push([
      t.id,
      accountId,
      t.type,
      t.sent,
      t.received,
      dateToIso(t.timestamp),
      t.blockHeight ?? null,
      t.address ?? null,
      t.label ?? '',
      t.fee ?? null,
      t.size ?? null,
      t.vsize ?? null,
      t.weight ?? null,
      t.version ?? null,
      t.lockTime ?? null,
      t.lockTimeEnabled ? 1 : 0,
      optionalToJson(t.raw),
      JSON.stringify(t.prices ?? {})
    ])

    for (const [i, input] of t.vin.entries()) {
      inputRows.push([
        t.id,
        accountId,
        i,
        input.previousOutput.txid,
        input.previousOutput.vout,
        input.sequence,
        optionalToJson(input.scriptSig),
        optionalToJson(input.witness),
        input.value ?? null,
        input.label ?? null
      ])
    }

    for (const [i, output] of t.vout.entries()) {
      outputRows.push([
        t.id,
        accountId,
        i,
        output.value,
        output.address,
        optionalToJson(output.script),
        output.label ?? null
      ])
    }
  }

  // Parents must be written before children. `INSERT OR REPLACE` on
  // transactions deletes and re-inserts the row, and tx_inputs / tx_outputs
  // cascade on that delete — inserting children first would wipe them.
  bulkInsert(tx, TRANSACTIONS_INSERT, TRANSACTIONS_COLUMNS, txRows)

  // The cascade above already removed old children for replaced rows. These
  // deletes cover transactions whose parent row was inserted fresh but whose
  // children somehow persisted, keeping vin/vout free of stale indexes.
  for (const t of deduped) {
    tx.execute('DELETE FROM tx_inputs WHERE tx_id = ? AND account_id = ?', [
      t.id,
      accountId
    ])
    tx.execute('DELETE FROM tx_outputs WHERE tx_id = ? AND account_id = ?', [
      t.id,
      accountId
    ])
  }

  bulkInsert(tx, TX_INPUTS_INSERT, TX_INPUTS_COLUMNS, inputRows)
  bulkInsert(tx, TX_OUTPUTS_INSERT, TX_OUTPUTS_COLUMNS, outputRows)
}

function upsertSingleTransaction(accountId: string, transaction: Transaction) {
  runTransaction((tx) => {
    upsertTransactions(tx, accountId, [transaction])
  })
}

export { upsertSingleTransaction, upsertTransactions }
