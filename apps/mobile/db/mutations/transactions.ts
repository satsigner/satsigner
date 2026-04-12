import { type NitroSQLiteConnection } from 'react-native-nitro-sqlite'

import { type Transaction } from '@/types/models/Transaction'

import { runTransaction } from '../connection'
import { dateToIso, optionalToJson } from '../mappers'

type TransactionContext = NitroSQLiteConnection

function upsertTransactions(
  tx: TransactionContext,
  accountId: string,
  transactions: Transaction[]
) {
  for (const t of transactions) {
    tx.execute(
      `INSERT OR REPLACE INTO transactions (
        id, account_id, type, sent, received, timestamp, block_height,
        address, label, fee, size, vsize, weight, version,
        lock_time, lock_time_enabled, raw, prices
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    )

    // Delete existing vin/vout then re-insert
    tx.execute('DELETE FROM tx_inputs WHERE tx_id = ? AND account_id = ?', [
      t.id,
      accountId
    ])
    tx.execute('DELETE FROM tx_outputs WHERE tx_id = ? AND account_id = ?', [
      t.id,
      accountId
    ])

    for (const [i, input] of t.vin.entries()) {
      tx.execute(
        `INSERT INTO tx_inputs (
          tx_id, account_id, input_index, prev_txid, prev_vout,
          sequence, script_sig, witness, value, label
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ]
      )
    }

    for (const [i, output] of t.vout.entries()) {
      tx.execute(
        `INSERT INTO tx_outputs (
          tx_id, account_id, output_index, value, address, script, label
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          t.id,
          accountId,
          i,
          output.value,
          output.address,
          optionalToJson(output.script),
          output.label ?? null
        ]
      )
    }
  }
}

function upsertSingleTransaction(accountId: string, transaction: Transaction) {
  runTransaction((tx) => {
    upsertTransactions(tx, accountId, [transaction])
  })
}

export { upsertSingleTransaction, upsertTransactions }
