import { type Account } from '@/types/models/Account'

import { runTransaction } from '../connection'
import { dateToIso } from '../mappers'
import { upsertAddresses } from './addresses'
import { upsertLabels } from './labels'
import { upsertTransactions } from './transactions'
import { upsertUtxos } from './utxos'

function syncAccountData(
  accountId: string,
  data: {
    transactions: Account['transactions']
    utxos: Account['utxos']
    addresses: Account['addresses']
    labels: Account['labels']
    summary: Account['summary']
    syncStatus: Account['syncStatus']
    lastSyncedAt?: Date
  }
) {
  runTransaction((tx) => {
    // Replace transactions, utxos, addresses
    tx.execute('DELETE FROM transactions WHERE account_id = ?', [accountId])
    tx.execute('DELETE FROM utxos WHERE account_id = ?', [accountId])
    tx.execute('DELETE FROM addresses WHERE account_id = ?', [accountId])
    tx.execute('DELETE FROM address_transactions WHERE account_id = ?', [
      accountId
    ])
    tx.execute('DELETE FROM address_utxos WHERE account_id = ?', [accountId])

    upsertTransactions(tx, accountId, data.transactions)
    upsertUtxos(tx, accountId, data.utxos)
    upsertAddresses(tx, accountId, data.addresses)
    upsertLabels(tx, accountId, data.labels)

    // Update account summary
    tx.execute(
      `UPDATE accounts SET
        balance = ?, num_addresses = ?, num_transactions = ?,
        num_utxos = ?, sats_in_mempool = ?,
        sync_status = ?, last_synced_at = ?
      WHERE id = ?`,
      [
        data.summary.balance,
        data.summary.numberOfAddresses,
        data.summary.numberOfTransactions,
        data.summary.numberOfUtxos,
        data.summary.satsInMempool,
        data.syncStatus,
        dateToIso(data.lastSyncedAt),
        accountId
      ]
    )
  })
}

export { syncAccountData }
