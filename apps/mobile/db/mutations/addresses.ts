import { type Transaction as SqlTransaction } from 'react-native-nitro-sqlite'

import { type Address } from '@/types/models/Address'

type TransactionContext = SqlTransaction

function upsertAddresses(
  tx: TransactionContext,
  accountId: string,
  addresses: Address[]
) {
  for (const addr of addresses) {
    tx.execute(
      `INSERT OR REPLACE INTO addresses (
        address, account_id, label, derivation_path, addr_index,
        keychain, network, script_version,
        utxo_count, tx_count, balance, sats_in_mempool
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    )

    // Junction: address <-> transactions
    for (const txId of addr.transactions) {
      tx.execute(
        'INSERT OR IGNORE INTO address_transactions (address, account_id, tx_id) VALUES (?, ?, ?)',
        [addr.address, accountId, txId]
      )
    }

    // Junction: address <-> utxos
    for (const utxoRef of addr.utxos) {
      tx.execute(
        'INSERT OR IGNORE INTO address_utxos (address, account_id, utxo_ref) VALUES (?, ?, ?)',
        [addr.address, accountId, utxoRef]
      )
    }
  }
}

export { upsertAddresses }
