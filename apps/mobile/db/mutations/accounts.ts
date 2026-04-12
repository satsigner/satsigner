import { type Account } from '@/types/models/Account'

import { getDb, runTransaction } from '../connection'
import { boolToInt, dateToIso, optionalToJson } from '../mappers'
import { upsertAddresses } from './addresses'
import { upsertLabels } from './labels'
import { upsertNostrData } from './nostr'
import { upsertTransactions } from './transactions'
import { upsertUtxos } from './utxos'

function insertAccount(account: Account) {
  runTransaction((tx) => {
    tx.execute(
      `INSERT INTO accounts (
        id, name, network, policy_type, keys, key_count, keys_required,
        balance, num_addresses, num_transactions, num_utxos, sats_in_mempool,
        created_at, last_synced_at, sync_status, sync_progress_total, sync_progress_done,
        nostr_auto_sync, nostr_common_npub, nostr_common_nsec,
        nostr_device_npub, nostr_device_nsec, nostr_device_display_name, nostr_device_picture,
        nostr_last_backup_fingerprint, nostr_last_updated, nostr_sync_start,
        nostr_npub_aliases, nostr_npub_profiles
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.name,
        account.network,
        account.policyType,
        JSON.stringify(account.keys),
        account.keyCount,
        account.keysRequired,
        account.summary.balance,
        account.summary.numberOfAddresses,
        account.summary.numberOfTransactions,
        account.summary.numberOfUtxos,
        account.summary.satsInMempool,
        dateToIso(account.createdAt) ?? new Date().toISOString(),
        dateToIso(account.lastSyncedAt),
        account.syncStatus,
        account.syncProgress?.totalTasks ?? null,
        account.syncProgress?.tasksDone ?? null,
        boolToInt(account.nostr?.autoSync),
        account.nostr?.commonNpub ?? '',
        account.nostr?.commonNsec ?? '',
        account.nostr?.deviceNpub ?? null,
        account.nostr?.deviceNsec ?? null,
        account.nostr?.deviceDisplayName ?? null,
        account.nostr?.devicePicture ?? null,
        account.nostr?.lastBackupFingerprint ?? null,
        dateToIso(account.nostr?.lastUpdated),
        dateToIso(account.nostr?.syncStart),
        optionalToJson(account.nostr?.npubAliases) ?? '{}',
        optionalToJson(account.nostr?.npubProfiles) ?? '{}'
      ]
    )

    upsertTransactions(tx, account.id, account.transactions)
    upsertUtxos(tx, account.id, account.utxos)
    upsertAddresses(tx, account.id, account.addresses)
    upsertLabels(tx, account.id, account.labels)
    upsertNostrData(tx, account.id, account.nostr)
  })
}

function updateAccountRow(account: Account) {
  const db = getDb()
  db.execute(
    `UPDATE accounts SET
      name = ?, network = ?, policy_type = ?, keys = ?,
      key_count = ?, keys_required = ?,
      balance = ?, num_addresses = ?, num_transactions = ?,
      num_utxos = ?, sats_in_mempool = ?,
      last_synced_at = ?, sync_status = ?,
      sync_progress_total = ?, sync_progress_done = ?,
      nostr_auto_sync = ?, nostr_common_npub = ?, nostr_common_nsec = ?,
      nostr_device_npub = ?, nostr_device_nsec = ?,
      nostr_device_display_name = ?, nostr_device_picture = ?,
      nostr_last_backup_fingerprint = ?, nostr_last_updated = ?, nostr_sync_start = ?,
      nostr_npub_aliases = ?, nostr_npub_profiles = ?
    WHERE id = ?`,
    [
      account.name,
      account.network,
      account.policyType,
      JSON.stringify(account.keys),
      account.keyCount,
      account.keysRequired,
      account.summary.balance,
      account.summary.numberOfAddresses,
      account.summary.numberOfTransactions,
      account.summary.numberOfUtxos,
      account.summary.satsInMempool,
      dateToIso(account.lastSyncedAt),
      account.syncStatus,
      account.syncProgress?.totalTasks ?? null,
      account.syncProgress?.tasksDone ?? null,
      boolToInt(account.nostr?.autoSync),
      account.nostr?.commonNpub ?? '',
      account.nostr?.commonNsec ?? '',
      account.nostr?.deviceNpub ?? null,
      account.nostr?.deviceNsec ?? null,
      account.nostr?.deviceDisplayName ?? null,
      account.nostr?.devicePicture ?? null,
      account.nostr?.lastBackupFingerprint ?? null,
      dateToIso(account.nostr?.lastUpdated),
      dateToIso(account.nostr?.syncStart),
      optionalToJson(account.nostr?.npubAliases) ?? '{}',
      optionalToJson(account.nostr?.npubProfiles) ?? '{}',
      account.id
    ]
  )
}

function updateFullAccount(account: Account) {
  runTransaction((tx) => {
    // Update account row
    tx.execute(
      `UPDATE accounts SET
        name = ?, network = ?, policy_type = ?, keys = ?,
        key_count = ?, keys_required = ?,
        balance = ?, num_addresses = ?, num_transactions = ?,
        num_utxos = ?, sats_in_mempool = ?,
        last_synced_at = ?, sync_status = ?,
        sync_progress_total = ?, sync_progress_done = ?,
        nostr_auto_sync = ?, nostr_common_npub = ?, nostr_common_nsec = ?,
        nostr_device_npub = ?, nostr_device_nsec = ?,
        nostr_device_display_name = ?, nostr_device_picture = ?,
        nostr_last_backup_fingerprint = ?, nostr_last_updated = ?, nostr_sync_start = ?,
        nostr_npub_aliases = ?, nostr_npub_profiles = ?
      WHERE id = ?`,
      [
        account.name,
        account.network,
        account.policyType,
        JSON.stringify(account.keys),
        account.keyCount,
        account.keysRequired,
        account.summary.balance,
        account.summary.numberOfAddresses,
        account.summary.numberOfTransactions,
        account.summary.numberOfUtxos,
        account.summary.satsInMempool,
        dateToIso(account.lastSyncedAt),
        account.syncStatus,
        account.syncProgress?.totalTasks ?? null,
        account.syncProgress?.tasksDone ?? null,
        boolToInt(account.nostr?.autoSync),
        account.nostr?.commonNpub ?? '',
        account.nostr?.commonNsec ?? '',
        account.nostr?.deviceNpub ?? null,
        account.nostr?.deviceNsec ?? null,
        account.nostr?.deviceDisplayName ?? null,
        account.nostr?.devicePicture ?? null,
        account.nostr?.lastBackupFingerprint ?? null,
        dateToIso(account.nostr?.lastUpdated),
        dateToIso(account.nostr?.syncStart),
        optionalToJson(account.nostr?.npubAliases) ?? '{}',
        optionalToJson(account.nostr?.npubProfiles) ?? '{}',
        account.id
      ]
    )

    // Replace child data
    tx.execute('DELETE FROM transactions WHERE account_id = ?', [account.id])
    tx.execute('DELETE FROM utxos WHERE account_id = ?', [account.id])
    tx.execute('DELETE FROM addresses WHERE account_id = ?', [account.id])

    upsertTransactions(tx, account.id, account.transactions)
    upsertUtxos(tx, account.id, account.utxos)
    upsertAddresses(tx, account.id, account.addresses)
    upsertLabels(tx, account.id, account.labels)
    upsertNostrData(tx, account.id, account.nostr)
  })
}

function deleteAccount(id: string) {
  const db = getDb()
  db.execute('DELETE FROM accounts WHERE id = ?', [id])
}

function deleteAllAccounts() {
  const db = getDb()
  db.execute('DELETE FROM accounts')
}

function updateAccountName(id: string, name: string) {
  const db = getDb()
  db.execute('UPDATE accounts SET name = ? WHERE id = ?', [name, id])
}

function updateAccountKeys(id: string, keys: Account['keys']) {
  const db = getDb()
  db.execute('UPDATE accounts SET keys = ? WHERE id = ?', [
    JSON.stringify(keys),
    id
  ])
}

function updateSyncStatus(id: string, syncStatus: Account['syncStatus']) {
  const db = getDb()
  db.execute('UPDATE accounts SET sync_status = ? WHERE id = ?', [
    syncStatus,
    id
  ])
}

function updateSyncProgress(
  id: string,
  progress: NonNullable<Account['syncProgress']>
) {
  const db = getDb()
  db.execute(
    'UPDATE accounts SET sync_progress_total = ?, sync_progress_done = ? WHERE id = ?',
    [progress.totalTasks, progress.tasksDone, id]
  )
}

function updateLastSyncedAt(id: string, date: Date) {
  const db = getDb()
  db.execute('UPDATE accounts SET last_synced_at = ? WHERE id = ?', [
    dateToIso(date),
    id
  ])
}

export {
  deleteAccount,
  deleteAllAccounts,
  insertAccount,
  updateAccountKeys,
  updateAccountName,
  updateAccountRow,
  updateFullAccount,
  updateLastSyncedAt,
  updateSyncProgress,
  updateSyncStatus
}
