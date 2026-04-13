import { type NitroSQLiteConnection } from 'react-native-nitro-sqlite'

const CURRENT_VERSION = 1

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  network TEXT NOT NULL,
  policy_type TEXT NOT NULL,
  keys TEXT NOT NULL,
  key_count INTEGER NOT NULL DEFAULT 1,
  keys_required INTEGER NOT NULL DEFAULT 1,
  balance INTEGER NOT NULL DEFAULT 0,
  num_addresses INTEGER NOT NULL DEFAULT 0,
  num_transactions INTEGER NOT NULL DEFAULT 0,
  num_utxos INTEGER NOT NULL DEFAULT 0,
  sats_in_mempool INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_synced_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'unsynced',
  sync_progress_total INTEGER,
  sync_progress_done INTEGER,
  nostr_auto_sync INTEGER NOT NULL DEFAULT 0,
  nostr_common_npub TEXT NOT NULL DEFAULT '',
  nostr_common_nsec TEXT NOT NULL DEFAULT '',
  nostr_device_npub TEXT DEFAULT '',
  nostr_device_nsec TEXT DEFAULT '',
  nostr_device_display_name TEXT,
  nostr_device_picture TEXT,
  nostr_last_backup_fingerprint TEXT,
  nostr_last_updated TEXT,
  nostr_sync_start TEXT,
  nostr_npub_aliases TEXT DEFAULT '{}',
  nostr_npub_profiles TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  received INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT,
  block_height INTEGER,
  address TEXT,
  label TEXT DEFAULT '',
  fee INTEGER,
  size INTEGER,
  vsize INTEGER,
  weight INTEGER,
  version INTEGER,
  lock_time INTEGER,
  lock_time_enabled INTEGER NOT NULL DEFAULT 0,
  raw TEXT,
  prices TEXT DEFAULT '{}',
  PRIMARY KEY (id, account_id)
);

CREATE TABLE IF NOT EXISTS tx_inputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  input_index INTEGER NOT NULL,
  prev_txid TEXT NOT NULL,
  prev_vout INTEGER NOT NULL,
  sequence INTEGER NOT NULL,
  script_sig TEXT,
  witness TEXT,
  value INTEGER,
  label TEXT,
  FOREIGN KEY (tx_id, account_id) REFERENCES transactions(id, account_id) ON DELETE CASCADE,
  UNIQUE (tx_id, account_id, input_index)
);

CREATE TABLE IF NOT EXISTS tx_outputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  output_index INTEGER NOT NULL,
  value INTEGER NOT NULL,
  address TEXT NOT NULL,
  script TEXT,
  label TEXT,
  FOREIGN KEY (tx_id, account_id) REFERENCES transactions(id, account_id) ON DELETE CASCADE,
  UNIQUE (tx_id, account_id, output_index)
);

CREATE TABLE IF NOT EXISTS utxos (
  txid TEXT NOT NULL,
  vout INTEGER NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  value INTEGER NOT NULL,
  timestamp TEXT,
  label TEXT DEFAULT '',
  address_to TEXT,
  keychain TEXT NOT NULL,
  script TEXT,
  PRIMARY KEY (txid, vout, account_id)
);

CREATE TABLE IF NOT EXISTS addresses (
  address TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label TEXT DEFAULT '',
  derivation_path TEXT,
  addr_index INTEGER,
  keychain TEXT,
  network TEXT,
  script_version TEXT,
  utxo_count INTEGER NOT NULL DEFAULT 0,
  tx_count INTEGER NOT NULL DEFAULT 0,
  balance INTEGER NOT NULL DEFAULT 0,
  sats_in_mempool INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (address, account_id)
);

CREATE TABLE IF NOT EXISTS address_transactions (
  address TEXT NOT NULL,
  account_id TEXT NOT NULL,
  tx_id TEXT NOT NULL,
  PRIMARY KEY (address, account_id, tx_id)
);

CREATE TABLE IF NOT EXISTS address_utxos (
  address TEXT NOT NULL,
  account_id TEXT NOT NULL,
  utxo_ref TEXT NOT NULL,
  PRIMARY KEY (address, account_id, utxo_ref)
);

CREATE TABLE IF NOT EXISTS labels (
  ref TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  fee INTEGER,
  fmv TEXT,
  height INTEGER,
  heights TEXT,
  keypath TEXT,
  origin TEXT,
  rate TEXT,
  spendable INTEGER,
  time TEXT,
  value INTEGER,
  PRIMARY KEY (ref, account_id)
);

CREATE TABLE IF NOT EXISTS tags (tag TEXT PRIMARY KEY NOT NULL);

CREATE TABLE IF NOT EXISTS nostr_dms (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event TEXT NOT NULL DEFAULT '',
  label INTEGER NOT NULL DEFAULT 0,
  content_description TEXT DEFAULT '',
  content_created_at INTEGER,
  content_pubkey TEXT,
  pending INTEGER NOT NULL DEFAULT 0,
  read INTEGER,
  PRIMARY KEY (id, account_id)
);

CREATE TABLE IF NOT EXISTS nostr_relays (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  PRIMARY KEY (account_id, url)
);

CREATE TABLE IF NOT EXISTS nostr_trusted_devices (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_npub TEXT NOT NULL,
  PRIMARY KEY (account_id, device_npub)
);

CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_utxos_account ON utxos(account_id);
CREATE INDEX IF NOT EXISTS idx_utxos_address ON utxos(address_to, account_id);
CREATE INDEX IF NOT EXISTS idx_addresses_account ON addresses(account_id);
CREATE INDEX IF NOT EXISTS idx_labels_account ON labels(account_id);
CREATE INDEX IF NOT EXISTS idx_labels_type ON labels(type, account_id);
CREATE INDEX IF NOT EXISTS idx_tx_outputs_address ON tx_outputs(address, account_id);
CREATE INDEX IF NOT EXISTS idx_tx_inputs_prev ON tx_inputs(prev_txid, prev_vout, account_id);
CREATE INDEX IF NOT EXISTS idx_nostr_dms_account ON nostr_dms(account_id);
CREATE INDEX IF NOT EXISTS idx_nostr_dms_unread ON nostr_dms(account_id, read) WHERE read = 0;
`

function getSchemaVersion(db: NitroSQLiteConnection): number {
  try {
    const { results } = db.execute('SELECT version FROM schema_version LIMIT 1')
    if (results && results.length > 0) {
      return results[0].version as number
    }
  } catch {
    // Table doesn't exist yet
  }
  return 0
}

function setSchemaVersion(db: NitroSQLiteConnection, version: number) {
  db.execute('DELETE FROM schema_version')
  db.execute('INSERT INTO schema_version (version) VALUES (?)', [version])
}

function runMigrations(db: NitroSQLiteConnection) {
  const currentVersion = getSchemaVersion(db)

  if (currentVersion >= CURRENT_VERSION) {
    return
  }

  if (currentVersion < 1) {
    const statements = SCHEMA_V1.split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const statement of statements) {
      db.execute(statement)
    }
    setSchemaVersion(db, 1)
  }
}

export { runMigrations }
