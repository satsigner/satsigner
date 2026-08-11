import {
  type NitroSQLiteConnection,
  type SQLiteValue
} from 'react-native-nitro-sqlite'

import { type Utxo } from '@/types/models/Utxo'

import { bulkInsert } from '../bulkInsert'
import { dateToIso, optionalToJson } from '../mappers'

type TransactionContext = NitroSQLiteConnection

const UTXOS_INSERT = `INSERT OR REPLACE INTO utxos (
  txid, vout, account_id, value, timestamp, label,
  address_to, keychain, script
)`
const UTXOS_COLUMNS = 9

function upsertUtxos(tx: TransactionContext, accountId: string, utxos: Utxo[]) {
  const rows: SQLiteValue[][] = utxos.map((utxo) => [
    utxo.txid,
    utxo.vout,
    accountId,
    utxo.value,
    dateToIso(utxo.timestamp),
    utxo.label ?? '',
    utxo.addressTo ?? null,
    utxo.keychain,
    optionalToJson(utxo.script)
  ])

  bulkInsert(tx, UTXOS_INSERT, UTXOS_COLUMNS, rows)
}

export { upsertUtxos }
