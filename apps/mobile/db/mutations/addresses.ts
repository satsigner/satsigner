import {
  type NitroSQLiteConnection,
  type SQLiteValue
} from 'react-native-nitro-sqlite'

import { type Address } from '@/types/models/Address'

import { bulkInsert } from '../bulkInsert'

type TransactionContext = NitroSQLiteConnection

const ADDRESSES_INSERT = `INSERT OR REPLACE INTO addresses (
  address, account_id, label, derivation_path, addr_index,
  keychain, network, script_version,
  utxo_count, tx_count, balance, sats_in_mempool
)`
const ADDRESSES_COLUMNS = 12

const ADDRESS_TRANSACTIONS_INSERT =
  'INSERT OR IGNORE INTO address_transactions (address, account_id, tx_id)'
const ADDRESS_TRANSACTIONS_COLUMNS = 3

const ADDRESS_UTXOS_INSERT =
  'INSERT OR IGNORE INTO address_utxos (address, account_id, utxo_ref)'
const ADDRESS_UTXOS_COLUMNS = 3

function upsertAddresses(
  tx: TransactionContext,
  accountId: string,
  addresses: Address[]
) {
  if (addresses.length === 0) {
    return
  }

  const addressRows: SQLiteValue[][] = []
  const txJunctionRows: SQLiteValue[][] = []
  const utxoJunctionRows: SQLiteValue[][] = []

  for (const addr of addresses) {
    addressRows.push([
      addr.address,
      accountId,
      addr.label ?? '',
      addr.derivationPath ?? null,
      addr.index ?? null,
      addr.keychain ?? null,
      addr.network ?? null,
      addr.scriptVersion ?? null,
      addr.summary.utxos,
      addr.summary.transactions,
      addr.summary.balance,
      addr.summary.satsInMempool
    ])

    for (const txId of addr.transactions) {
      txJunctionRows.push([addr.address, accountId, txId])
    }

    for (const utxoRef of addr.utxos) {
      utxoJunctionRows.push([addr.address, accountId, utxoRef])
    }
  }

  bulkInsert(tx, ADDRESSES_INSERT, ADDRESSES_COLUMNS, addressRows)
  bulkInsert(
    tx,
    ADDRESS_TRANSACTIONS_INSERT,
    ADDRESS_TRANSACTIONS_COLUMNS,
    txJunctionRows
  )
  bulkInsert(tx, ADDRESS_UTXOS_INSERT, ADDRESS_UTXOS_COLUMNS, utxoJunctionRows)
}

export { upsertAddresses }
