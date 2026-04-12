import {
  open,
  type NitroSQLiteConnection,
  type Transaction as SqlTransaction
} from 'react-native-nitro-sqlite'

import { runMigrations } from './schema'

const DB_NAME = 'satsigner.db'

let db: NitroSQLiteConnection | null = null

function getDb(): NitroSQLiteConnection {
  if (!db) {
    db = open({ name: DB_NAME })
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
 * Wraps a synchronous callback for db.transaction() which requires Promise return.
 * All nitro-sqlite JSI operations are synchronous, but the transaction API expects async.
 */
function runTransaction(fn: (tx: SqlTransaction) => void) {
  const db = getDb()
  return db.transaction((tx) => {
    fn(tx)
    return Promise.resolve()
  })
}

export { closeDb, getDb, runTransaction }
