import { type Address } from '@/types/models/Address'

import { getDb } from '../connection'
import { type AddressRow, rowToAddress } from '../mappers'

function getAddressesByAccount(accountId: string): Address[] {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM addresses WHERE account_id = ?',
    [accountId]
  )
  return (results ?? []).map((row) => {
    const addr = row as AddressRow
    const txIds = getAddressTxIds(accountId, addr.address)
    const utxoRefs = getAddressUtxoRefs(accountId, addr.address)
    return rowToAddress(addr, txIds, utxoRefs)
  })
}

function getAddress(accountId: string, address: string): Address | undefined {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM addresses WHERE account_id = ? AND address = ?',
    [accountId, address]
  )
  if (!results || results.length === 0) {
    return undefined
  }
  const row = results[0] as AddressRow
  const txIds = getAddressTxIds(accountId, address)
  const utxoRefs = getAddressUtxoRefs(accountId, address)
  return rowToAddress(row, txIds, utxoRefs)
}

function getAddressTxIds(accountId: string, address: string): string[] {
  const db = getDb()
  const { results } = db.execute(
    'SELECT tx_id FROM address_transactions WHERE account_id = ? AND address = ?',
    [accountId, address]
  )
  return (results ?? []).map((r) => r.tx_id as string)
}

function getAddressUtxoRefs(accountId: string, address: string): string[] {
  const db = getDb()
  const { results } = db.execute(
    'SELECT utxo_ref FROM address_utxos WHERE account_id = ? AND address = ?',
    [accountId, address]
  )
  return (results ?? []).map((r) => r.utxo_ref as string)
}

export {
  getAddress,
  getAddressTxIds,
  getAddressUtxoRefs,
  getAddressesByAccount
}
