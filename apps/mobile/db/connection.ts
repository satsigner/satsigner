import { open, type NitroSQLiteConnection } from 'react-native-nitro-sqlite'

import { runMigrations } from './schema'

const DB_NAME = 'satsigner.db'

let db: NitroSQLiteConnection | null = null

function getDb(): NitroSQLiteConnection {
  if (!db) {
    try {
      db = open({ name: DB_NAME })
    } catch {
      // Hot reload: nitro-sqlite tracks open DBs in a JS-side Map.
      // On reload our `db` resets but the Map persists, so open() throws.
      // closeDatabaseQueue is not publicly exported — require is intentional.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        closeDatabaseQueue
      } = require('react-native-nitro-sqlite/src/DatabaseQueue')
      closeDatabaseQueue(DB_NAME)
      db = open({ name: DB_NAME })
    }
    db.execute('PRAGMA journal_mode = WAL')
    db.execute('PRAGMA foreign_keys = ON')
    runMigrations(db)
  }
  return db
}

function closeDb() {
  if (db) {
    db.close()
    db = null
  }
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
