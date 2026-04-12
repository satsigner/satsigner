import { type Transaction as SqlTransaction } from 'react-native-nitro-sqlite'

import { type Utxo } from '@/types/models/Utxo'

import { dateToIso, optionalToJson } from '../mappers'

type TransactionContext = SqlTransaction

function upsertUtxos(tx: TransactionContext, accountId: string, utxos: Utxo[]) {
  for (const utxo of utxos) {
    tx.execute(
      `INSERT OR REPLACE INTO utxos (
        txid, vout, account_id, value, timestamp, label,
        address_to, keychain, script
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        utxo.txid,
        utxo.vout,
        accountId,
        utxo.value,
        dateToIso(utxo.timestamp),
        utxo.label ?? '',
        utxo.addressTo ?? null,
        utxo.keychain,
        optionalToJson(utxo.script)
      ]
    )
  }
}

export { upsertUtxos }
