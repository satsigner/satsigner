import { type Address } from '@/types/models/Address'

import { getDb } from '../connection'
import { type AddressRow, rowToAddress } from '../mappers'
import {
  getAddressTxIdsByAccount,
  getAddressUtxoRefsByAccount
} from './children'

function getAddressesByAccount(accountId: string): Address[] {
  const db = getDb()
  const { rows } = db.execute<AddressRow>(
    'SELECT * FROM addresses WHERE account_id = ?',
    [accountId]
  )
  const txIdsByAddress = getAddressTxIdsByAccount(accountId)
  const utxoRefsByAddress = getAddressUtxoRefsByAccount(accountId)
  return rows._array.map((addr) =>
    rowToAddress(
      addr,
      txIdsByAddress.get(addr.address) ?? [],
      utxoRefsByAddress.get(addr.address) ?? []
    )
  )
}

function getAddress(accountId: string, address: string): Address | undefined {
  const db = getDb()
  const row = db
    .execute<AddressRow>(
      'SELECT * FROM addresses WHERE account_id = ? AND address = ?',
      [accountId, address]
    )
    .rows.item(0)
  if (!row) {
    return undefined
  }
  const txIds = getAddressTxIds(accountId, address)
  const utxoRefs = getAddressUtxoRefs(accountId, address)
  return rowToAddress(row, txIds, utxoRefs)
}

function getAddressTxIds(accountId: string, address: string): string[] {
  const db = getDb()
  const { rows } = db.execute<{ tx_id: string }>(
    'SELECT tx_id FROM address_transactions WHERE account_id = ? AND address = ?',
    [accountId, address]
  )
  return rows._array.map((r) => r.tx_id)
}

function getAddressUtxoRefs(accountId: string, address: string): string[] {
  const db = getDb()
  const { rows } = db.execute<{ utxo_ref: string }>(
    'SELECT utxo_ref FROM address_utxos WHERE account_id = ? AND address = ?',
    [accountId, address]
  )
  return rows._array.map((r) => r.utxo_ref)
}

export {
  getAddress,
  getAddressTxIds,
  getAddressUtxoRefs,
  getAddressesByAccount
}
