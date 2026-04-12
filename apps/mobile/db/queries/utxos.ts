import { type Utxo } from '@/types/models/Utxo'

import { getDb } from '../connection'
import { type UtxoRow, rowToUtxo } from '../mappers'

function getUtxosByAccount(accountId: string): Utxo[] {
  const db = getDb()
  const { results } = db.execute('SELECT * FROM utxos WHERE account_id = ?', [
    accountId
  ])
  return (results ?? []).map((row) => rowToUtxo(row as UtxoRow))
}

function getUtxo(
  accountId: string,
  txid: string,
  vout: number
): Utxo | undefined {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM utxos WHERE account_id = ? AND txid = ? AND vout = ?',
    [accountId, txid, vout]
  )
  if (!results || results.length === 0) {
    return undefined
  }
  return rowToUtxo(results[0] as UtxoRow)
}

function getUtxosByAddress(accountId: string, address: string): Utxo[] {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM utxos WHERE account_id = ? AND address_to = ?',
    [accountId, address]
  )
  return (results ?? []).map((row) => rowToUtxo(row as UtxoRow))
}

export { getUtxo, getUtxosByAccount, getUtxosByAddress }
