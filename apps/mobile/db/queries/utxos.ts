import { type Utxo } from '@/types/models/Utxo'

import { getDb } from '../connection'
import { type UtxoRow, rowToUtxo } from '../mappers'

function getUtxosByAccount(accountId: string): Utxo[] {
  const db = getDb()
  const { rows } = db.execute<UtxoRow>(
    'SELECT * FROM utxos WHERE account_id = ?',
    [accountId]
  )
  return rows._array.map((row) => rowToUtxo(row))
}

function getUtxo(
  accountId: string,
  txid: string,
  vout: number
): Utxo | undefined {
  const db = getDb()
  const row = db
    .execute<UtxoRow>(
      'SELECT * FROM utxos WHERE account_id = ? AND txid = ? AND vout = ?',
      [accountId, txid, vout]
    )
    .rows.item(0)
  if (!row) {
    return undefined
  }
  return rowToUtxo(row)
}

function getUtxosByAddress(accountId: string, address: string): Utxo[] {
  const db = getDb()
  const { rows } = db.execute<UtxoRow>(
    'SELECT * FROM utxos WHERE account_id = ? AND address_to = ?',
    [accountId, address]
  )
  return rows._array.map((row) => rowToUtxo(row))
}

export { getUtxo, getUtxosByAccount, getUtxosByAddress }
