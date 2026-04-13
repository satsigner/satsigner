import { type NitroSQLiteConnection } from 'react-native-nitro-sqlite'

import { type Label } from '@/utils/bip329'

import { runTransaction } from '../connection'
import { dateToIso, optionalToJson } from '../mappers'

type TransactionContext = NitroSQLiteConnection

function upsertLabels(
  tx: TransactionContext,
  accountId: string,
  labels: Record<string, Label>
) {
  for (const [ref, label] of Object.entries(labels)) {
    if (!label || !label.label) {
      continue
    }
    tx.execute(
      `INSERT OR REPLACE INTO labels (
        ref, account_id, type, label, fee, fmv, height, heights,
        keypath, origin, rate, spendable, time, value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ref,
        accountId,
        label.type,
        label.label,
        label.fee ?? null,
        optionalToJson(label.fmv),
        label.height ?? null,
        optionalToJson(label.heights),
        label.keypath ?? null,
        label.origin ?? null,
        optionalToJson(label.rate),
        label.spendable !== undefined ? (label.spendable ? 1 : 0) : null,
        dateToIso(label.time as Date | undefined),
        label.value ?? null
      ]
    )
  }
}

function importLabels(accountId: string, labels: Label[]): number {
  let labelsAdded = 0

  runTransaction((tx) => {
    for (const labelObj of labels) {
      tx.execute(
        `INSERT OR REPLACE INTO labels (ref, account_id, type, label, fee, fmv, height, heights, keypath, origin, rate, spendable, time, value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          labelObj.ref,
          accountId,
          labelObj.type,
          labelObj.label,
          labelObj.fee ?? null,
          optionalToJson(labelObj.fmv),
          labelObj.height ?? null,
          optionalToJson(labelObj.heights),
          labelObj.keypath ?? null,
          labelObj.origin ?? null,
          optionalToJson(labelObj.rate),
          labelObj.spendable !== undefined
            ? labelObj.spendable
              ? 1
              : 0
            : null,
          dateToIso(labelObj.time as Date | undefined),
          labelObj.value ?? null
        ]
      )

      // Update denormalized label on entity tables
      if (labelObj.type === 'tx') {
        const { rowsAffected } = tx.execute(
          'UPDATE transactions SET label = ? WHERE id = ? AND account_id = ?',
          [labelObj.label, labelObj.ref, accountId]
        )
        if (rowsAffected > 0) {
          labelsAdded += 1
        }
      } else if (labelObj.type === 'output') {
        // ref format: txid:vout
        const parts = labelObj.ref.split(':')
        if (parts.length >= 2) {
          const txid = parts.slice(0, -1).join(':')
          const vout = Number(parts.at(-1))
          const { rowsAffected } = tx.execute(
            'UPDATE utxos SET label = ? WHERE txid = ? AND vout = ? AND account_id = ?',
            [labelObj.label, txid, vout, accountId]
          )
          if (rowsAffected > 0) {
            labelsAdded += 1
          }
        }
      } else if (labelObj.type === 'addr') {
        const { rowsAffected } = tx.execute(
          'UPDATE addresses SET label = ? WHERE address = ? AND account_id = ?',
          [labelObj.label, labelObj.ref, accountId]
        )
        if (rowsAffected > 0) {
          labelsAdded += 1
        }
      }
    }
  })

  return labelsAdded
}

function cascadeAddrLabel(accountId: string, addr: string, label: string) {
  runTransaction((tx) => {
    // 1. Set/update the address label
    tx.execute(
      `INSERT INTO labels (ref, account_id, type, label) VALUES (?, ?, 'addr', ?)
       ON CONFLICT(ref, account_id) DO UPDATE SET label = excluded.label`,
      [addr, accountId, label]
    )
    tx.execute(
      'UPDATE addresses SET label = ? WHERE address = ? AND account_id = ?',
      [label, addr, accountId]
    )

    // 2. Cascade to unlabeled UTXOs at this address
    tx.execute(
      `INSERT OR IGNORE INTO labels (ref, account_id, type, label)
       SELECT (u.txid || ':' || u.vout), ?, 'output', ?
       FROM utxos u
       WHERE u.address_to = ? AND u.account_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = (u.txid || ':' || u.vout) AND l.account_id = ?
         )`,
      [accountId, label, addr, accountId, accountId]
    )
    tx.execute(
      `UPDATE utxos SET label = ?
       WHERE address_to = ? AND account_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = (utxos.txid || ':' || utxos.vout)
             AND l.account_id = ? AND l.type = 'output'
             AND l.label != ?
         )`,
      [label, addr, accountId, accountId, label]
    )

    // 3. Cascade to unlabeled TXs that have outputs to this address
    tx.execute(
      `INSERT OR IGNORE INTO labels (ref, account_id, type, label)
       SELECT o.tx_id, ?, 'tx', ?
       FROM tx_outputs o
       WHERE o.address = ? AND o.account_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM labels l WHERE l.ref = o.tx_id AND l.account_id = ?
         )`,
      [accountId, label, addr, accountId, accountId]
    )
    tx.execute(
      `UPDATE transactions SET label = ?
       WHERE account_id = ?
         AND id IN (SELECT o.tx_id FROM tx_outputs o WHERE o.address = ? AND o.account_id = ?)
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = transactions.id AND l.account_id = ? AND l.type = 'tx'
             AND l.label != ?
         )`,
      [label, accountId, addr, accountId, accountId, label]
    )

    // 4. Cascade to unlabeled TXs that spend from this address
    //    (inputs whose previous output resolves to this address)
    tx.execute(
      `INSERT OR IGNORE INTO labels (ref, account_id, type, label)
       SELECT i.tx_id, ?, 'tx', ?
       FROM tx_inputs i
       JOIN tx_outputs o ON o.tx_id = i.prev_txid AND o.output_index = i.prev_vout AND o.account_id = ?
       WHERE i.account_id = ? AND o.address = ?
         AND NOT EXISTS (
           SELECT 1 FROM labels l WHERE l.ref = i.tx_id AND l.account_id = ?
         )`,
      [accountId, label, accountId, accountId, addr, accountId]
    )
    tx.execute(
      `UPDATE transactions SET label = ?
       WHERE account_id = ?
         AND id IN (
           SELECT i.tx_id FROM tx_inputs i
           JOIN tx_outputs o ON o.tx_id = i.prev_txid AND o.output_index = i.prev_vout AND o.account_id = ?
           WHERE i.account_id = ? AND o.address = ?
         )
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = transactions.id AND l.account_id = ? AND l.type = 'tx'
             AND l.label != ?
         )`,
      [label, accountId, accountId, accountId, addr, accountId, label]
    )
  })
}

function cascadeTxLabel(accountId: string, txid: string, label: string) {
  runTransaction((tx) => {
    // 1. Set/update the tx label
    tx.execute(
      `INSERT INTO labels (ref, account_id, type, label) VALUES (?, ?, 'tx', ?)
       ON CONFLICT(ref, account_id) DO UPDATE SET label = excluded.label`,
      [txid, accountId, label]
    )
    tx.execute(
      'UPDATE transactions SET label = ? WHERE id = ? AND account_id = ?',
      [label, txid, accountId]
    )

    // 2. Cascade to unlabeled outputs (vout)
    tx.execute(
      `INSERT OR IGNORE INTO labels (ref, account_id, type, label)
       SELECT (o.tx_id || ':' || o.output_index), ?, 'output', ?
       FROM tx_outputs o
       WHERE o.tx_id = ? AND o.account_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = (o.tx_id || ':' || o.output_index) AND l.account_id = ?
         )`,
      [accountId, label, txid, accountId, accountId]
    )
    // Update UTXO objects for those outputs
    tx.execute(
      `UPDATE utxos SET label = ?
       WHERE account_id = ? AND txid = ?
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = (utxos.txid || ':' || utxos.vout)
             AND l.account_id = ? AND l.type = 'output'
             AND l.label != ?
         )`,
      [label, accountId, txid, accountId, label]
    )
    // Update tx_outputs label
    tx.execute(
      `UPDATE tx_outputs SET label = ?
       WHERE tx_id = ? AND account_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = (tx_outputs.tx_id || ':' || tx_outputs.output_index)
             AND l.account_id = ?
             AND l.label != ?
         )`,
      [label, txid, accountId, accountId, label]
    )

    // 3. Cascade to unlabeled addresses from outputs
    tx.execute(
      `INSERT OR IGNORE INTO labels (ref, account_id, type, label)
       SELECT o.address, ?, 'addr', ?
       FROM tx_outputs o
       WHERE o.tx_id = ? AND o.account_id = ?
         AND o.address IS NOT NULL AND o.address != ''
         AND NOT EXISTS (
           SELECT 1 FROM labels l WHERE l.ref = o.address AND l.account_id = ?
         )`,
      [accountId, label, txid, accountId, accountId]
    )
    tx.execute(
      `UPDATE addresses SET label = ?
       WHERE account_id = ?
         AND address IN (
           SELECT o.address FROM tx_outputs o
           WHERE o.tx_id = ? AND o.account_id = ?
         )
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = addresses.address AND l.account_id = ?
             AND l.label != ?
         )`,
      [label, accountId, txid, accountId, accountId, label]
    )

    // 4. Cascade to unlabeled inputs (previous outputs)
    tx.execute(
      `INSERT OR IGNORE INTO labels (ref, account_id, type, label)
       SELECT (i.prev_txid || ':' || i.prev_vout), ?, 'output', ?
       FROM tx_inputs i
       WHERE i.tx_id = ? AND i.account_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = (i.prev_txid || ':' || i.prev_vout) AND l.account_id = ?
         )`,
      [accountId, label, txid, accountId, accountId]
    )
    // Update vout objects on referenced transactions
    tx.execute(
      `UPDATE tx_outputs SET label = ?
       WHERE account_id = ?
         AND (tx_id, output_index) IN (
           SELECT i.prev_txid, i.prev_vout FROM tx_inputs i
           WHERE i.tx_id = ? AND i.account_id = ?
         )
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = (tx_outputs.tx_id || ':' || tx_outputs.output_index)
             AND l.account_id = ?
             AND l.label != ?
         )`,
      [label, accountId, txid, accountId, accountId, label]
    )

    // 5. Cascade to addresses of inputs via referenced tx_outputs
    tx.execute(
      `INSERT OR IGNORE INTO labels (ref, account_id, type, label)
       SELECT o.address, ?, 'addr', ?
       FROM tx_inputs i
       JOIN tx_outputs o ON o.tx_id = i.prev_txid AND o.output_index = i.prev_vout AND o.account_id = ?
       WHERE i.tx_id = ? AND i.account_id = ?
         AND o.address IS NOT NULL AND o.address != ''
         AND NOT EXISTS (
           SELECT 1 FROM labels l WHERE l.ref = o.address AND l.account_id = ?
         )`,
      [accountId, label, accountId, txid, accountId, accountId]
    )
    tx.execute(
      `UPDATE addresses SET label = ?
       WHERE account_id = ?
         AND address IN (
           SELECT o.address FROM tx_inputs i
           JOIN tx_outputs o ON o.tx_id = i.prev_txid AND o.output_index = i.prev_vout AND o.account_id = ?
           WHERE i.tx_id = ? AND i.account_id = ?
         )
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = addresses.address AND l.account_id = ?
             AND l.label != ?
         )`,
      [label, accountId, accountId, txid, accountId, accountId, label]
    )
  })
}

function cascadeUtxoLabel(
  accountId: string,
  txid: string,
  vout: number,
  label: string
) {
  const utxoRef = `${txid}:${vout}`

  runTransaction((tx) => {
    // 1. Set/update the UTXO label
    tx.execute(
      `INSERT INTO labels (ref, account_id, type, label) VALUES (?, ?, 'output', ?)
       ON CONFLICT(ref, account_id) DO UPDATE SET label = excluded.label`,
      [utxoRef, accountId, label]
    )
    tx.execute(
      'UPDATE utxos SET label = ? WHERE txid = ? AND vout = ? AND account_id = ?',
      [label, txid, vout, accountId]
    )

    // 2. Cascade to unlabeled TX
    tx.execute(
      `INSERT OR IGNORE INTO labels (ref, account_id, type, label)
       SELECT ?, ?, 'tx', ?
       WHERE NOT EXISTS (
         SELECT 1 FROM labels l WHERE l.ref = ? AND l.account_id = ?
       )`,
      [txid, accountId, label, txid, accountId]
    )
    tx.execute(
      `UPDATE transactions SET label = ?
       WHERE id = ? AND account_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = ? AND l.account_id = ? AND l.type = 'tx'
             AND l.label != ?
         )`,
      [label, txid, accountId, txid, accountId, label]
    )
    // Update vout label on transaction
    tx.execute(
      `UPDATE tx_outputs SET label = ?
       WHERE tx_id = ? AND output_index = ? AND account_id = ?`,
      [label, txid, vout, accountId]
    )
    // Update vin label if this utxo is referenced as an input
    tx.execute(
      `UPDATE tx_inputs SET label = ?
       WHERE prev_txid = ? AND prev_vout = ? AND account_id = ?`,
      [label, txid, vout, accountId]
    )

    // 3. Cascade to unlabeled address of this UTXO
    tx.execute(
      `INSERT OR IGNORE INTO labels (ref, account_id, type, label)
       SELECT u.address_to, ?, 'addr', ?
       FROM utxos u
       WHERE u.txid = ? AND u.vout = ? AND u.account_id = ?
         AND u.address_to IS NOT NULL AND u.address_to != ''
         AND NOT EXISTS (
           SELECT 1 FROM labels l WHERE l.ref = u.address_to AND l.account_id = ?
         )`,
      [accountId, label, txid, vout, accountId, accountId]
    )
    tx.execute(
      `UPDATE addresses SET label = ?
       WHERE account_id = ?
         AND address = (
           SELECT u.address_to FROM utxos u
           WHERE u.txid = ? AND u.vout = ? AND u.account_id = ?
         )
         AND NOT EXISTS (
           SELECT 1 FROM labels l
           WHERE l.ref = addresses.address AND l.account_id = ?
             AND l.label != ?
         )`,
      [label, accountId, txid, vout, accountId, accountId, label]
    )
  })
}

export {
  cascadeAddrLabel,
  cascadeTxLabel,
  cascadeUtxoLabel,
  importLabels,
  upsertLabels
}
