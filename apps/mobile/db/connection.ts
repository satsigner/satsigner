import { open, type NitroSQLiteConnection } from 'react-native-nitro-sqlite'

import { runMigrations } from './schema'

const DB_NAME = 'satsigner.db'

declare global {
  // Persisted across Fast Refresh so nitro-sqlite's internal "already open"
  // Map (which also survives reload) stays in sync with our JS handle.
  // eslint-disable-next-line no-var
  var __satsignerDb: NitroSQLiteConnection | undefined
}

/** Resets on Fast Refresh; forces migrations when schema code reloads. */
let migratedForModuleLoad = false

function getDb(): NitroSQLiteConnection {
  if (!globalThis.__satsignerDb) {
    const db = open({ name: DB_NAME })
    db.execute('PRAGMA journal_mode = WAL')
    db.execute('PRAGMA foreign_keys = ON')
    globalThis.__satsignerDb = db
    migratedForModuleLoad = false
  }
  // Fast Refresh keeps the open handle but reloads this module, so migrate
  // once per module load — not on every getDb() call.
  if (!migratedForModuleLoad) {
    runMigrations(globalThis.__satsignerDb)
    migratedForModuleLoad = true
  }
  return globalThis.__satsignerDb
}

function closeDb() {
  if (globalThis.__satsignerDb) {
    globalThis.__satsignerDb.close()
    globalThis.__satsignerDb = undefined
  }
  migratedForModuleLoad = false
}

/**
 * Run multiple SQL statements in a synchronous transaction.
 * Uses manual BEGIN/COMMIT with sync JSI execute calls.
 * db.transaction() is async (queued) and can't be awaited from sync callers.
 */
function runTransaction(fn: (db: NitroSQLiteConnection) => void) {
  const conn = getDb()
  conn.execute('BEGIN TRANSACTION')
  try {
    fn(conn)
    conn.execute('COMMIT')
  } catch (error) {
    conn.execute('ROLLBACK')
    throw error
  }
}

export { closeDb, getDb, runTransaction }
