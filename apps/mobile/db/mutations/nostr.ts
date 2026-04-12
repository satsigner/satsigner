import {
  type SQLiteValue,
  type Transaction as SqlTransaction
} from 'react-native-nitro-sqlite'

import { type NostrAccount, type NostrDM } from '@/types/models/Nostr'

import { getDb } from '../connection'
import { boolToInt, dateToIso, optionalToJson } from '../mappers'

type TransactionContext = SqlTransaction

function upsertNostrData(
  tx: TransactionContext,
  accountId: string,
  nostr: NostrAccount
) {
  if (!nostr) {
    return
  }

  // Clear and re-insert DMs
  tx.execute('DELETE FROM nostr_dms WHERE account_id = ?', [accountId])
  for (const dm of nostr.dms) {
    tx.execute(
      `INSERT INTO nostr_dms (
        id, account_id, author, created_at, description, event, label,
        content_description, content_created_at, content_pubkey, pending, read
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dm.id,
        accountId,
        dm.author,
        dm.created_at,
        dm.description,
        dm.event,
        dm.label,
        dm.content?.description ?? '',
        dm.content?.created_at ?? null,
        dm.content?.pubkey ?? null,
        boolToInt(dm.pending),
        dm.read === undefined ? null : boolToInt(dm.read)
      ]
    )
  }

  // Clear and re-insert relays
  tx.execute('DELETE FROM nostr_relays WHERE account_id = ?', [accountId])
  for (const url of nostr.relays) {
    tx.execute('INSERT INTO nostr_relays (account_id, url) VALUES (?, ?)', [
      accountId,
      url
    ])
  }

  // Clear and re-insert trusted devices
  tx.execute('DELETE FROM nostr_trusted_devices WHERE account_id = ?', [
    accountId
  ])
  for (const npub of nostr.trustedMemberDevices) {
    tx.execute(
      'INSERT INTO nostr_trusted_devices (account_id, device_npub) VALUES (?, ?)',
      [accountId, npub]
    )
  }
}

function markDmsAsRead(accountId: string) {
  const db = getDb()
  db.execute(
    'UPDATE nostr_dms SET read = 1 WHERE account_id = ? AND read = 0',
    [accountId]
  )
}

function insertDm(accountId: string, dm: NostrDM) {
  const db = getDb()
  db.execute(
    `INSERT OR REPLACE INTO nostr_dms (
      id, account_id, author, created_at, description, event, label,
      content_description, content_created_at, content_pubkey, pending, read
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dm.id,
      accountId,
      dm.author,
      dm.created_at,
      dm.description,
      dm.event,
      dm.label,
      dm.content?.description ?? '',
      dm.content?.created_at ?? null,
      dm.content?.pubkey ?? null,
      boolToInt(dm.pending),
      dm.read === undefined ? null : boolToInt(dm.read)
    ]
  )
}

function updateAccountNostr(accountId: string, nostr: Partial<NostrAccount>) {
  const db = getDb()
  const updates: string[] = []
  const params: SQLiteValue[] = []

  if (nostr.autoSync !== undefined) {
    updates.push('nostr_auto_sync = ?')
    params.push(boolToInt(nostr.autoSync))
  }
  if (nostr.commonNpub !== undefined) {
    updates.push('nostr_common_npub = ?')
    params.push(nostr.commonNpub)
  }
  if (nostr.commonNsec !== undefined) {
    updates.push('nostr_common_nsec = ?')
    params.push(nostr.commonNsec)
  }
  if (nostr.deviceNpub !== undefined) {
    updates.push('nostr_device_npub = ?')
    params.push(nostr.deviceNpub)
  }
  if (nostr.deviceNsec !== undefined) {
    updates.push('nostr_device_nsec = ?')
    params.push(nostr.deviceNsec)
  }
  if (nostr.deviceDisplayName !== undefined) {
    updates.push('nostr_device_display_name = ?')
    params.push(nostr.deviceDisplayName)
  }
  if (nostr.devicePicture !== undefined) {
    updates.push('nostr_device_picture = ?')
    params.push(nostr.devicePicture)
  }
  if (nostr.lastBackupFingerprint !== undefined) {
    updates.push('nostr_last_backup_fingerprint = ?')
    params.push(nostr.lastBackupFingerprint)
  }
  if (nostr.lastUpdated !== undefined) {
    updates.push('nostr_last_updated = ?')
    params.push(dateToIso(nostr.lastUpdated))
  }
  if (nostr.syncStart !== undefined) {
    updates.push('nostr_sync_start = ?')
    params.push(dateToIso(nostr.syncStart))
  }
  if (nostr.npubAliases !== undefined) {
    updates.push('nostr_npub_aliases = ?')
    params.push(optionalToJson(nostr.npubAliases) ?? '{}')
  }
  if (nostr.npubProfiles !== undefined) {
    updates.push('nostr_npub_profiles = ?')
    params.push(optionalToJson(nostr.npubProfiles) ?? '{}')
  }

  if (updates.length === 0) {
    return
  }

  params.push(accountId)
  db.execute(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`, params)

  // Handle relays if provided
  if (nostr.relays !== undefined) {
    db.execute('DELETE FROM nostr_relays WHERE account_id = ?', [accountId])
    for (const url of nostr.relays) {
      db.execute('INSERT INTO nostr_relays (account_id, url) VALUES (?, ?)', [
        accountId,
        url
      ])
    }
  }

  // Handle trusted devices if provided
  if (nostr.trustedMemberDevices !== undefined) {
    db.execute('DELETE FROM nostr_trusted_devices WHERE account_id = ?', [
      accountId
    ])
    for (const npub of nostr.trustedMemberDevices) {
      db.execute(
        'INSERT INTO nostr_trusted_devices (account_id, device_npub) VALUES (?, ?)',
        [accountId, npub]
      )
    }
  }

  // Handle DMs if provided
  if (nostr.dms !== undefined) {
    db.execute('DELETE FROM nostr_dms WHERE account_id = ?', [accountId])
    for (const dm of nostr.dms) {
      insertDm(accountId, dm)
    }
  }
}

function upsertRelays(accountId: string, relays: string[]) {
  const db = getDb()
  db.execute('DELETE FROM nostr_relays WHERE account_id = ?', [accountId])
  for (const url of relays) {
    db.execute('INSERT INTO nostr_relays (account_id, url) VALUES (?, ?)', [
      accountId,
      url
    ])
  }
}

export {
  insertDm,
  markDmsAsRead,
  updateAccountNostr,
  upsertNostrData,
  upsertRelays
}
