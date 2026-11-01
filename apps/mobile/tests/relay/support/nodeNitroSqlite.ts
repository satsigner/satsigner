import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import { mockQueryResult } from '../../unit/db/queryResult'

type Row = Record<string, unknown>

// Relay scenarios need real SQL (migrations, INSERT OR IGNORE, MAX()), so the
// nitro-sqlite module is backed by an in-memory node:sqlite database here.
const databases = new Map<string, DatabaseSync>()

function toInput(value: unknown): SQLInputValue {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }
  if (
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'bigint'
  ) {
    return value
  }
  return String(value)
}

function plainRow(row: Row): Row {
  return { ...row }
}

function execute(db: DatabaseSync, sql: string, params: unknown[] = []) {
  const statement = db.prepare(sql)
  const inputs = params.map(toInput)
  if (/^\s*(select|pragma|with)\b/i.test(sql)) {
    return mockQueryResult(statement.all(...inputs).map(plainRow))
  }
  const { changes } = statement.run(...inputs)
  return { ...mockQueryResult([]), rowsAffected: Number(changes) }
}

export function open({ name }: { name: string }) {
  const db = databases.get(name) ?? new DatabaseSync(':memory:')
  databases.set(name, db)
  return {
    close: () => undefined,
    execute: (sql: string, params?: unknown[]) => execute(db, sql, params)
  }
}

/** Drops every in-memory database so each test file starts empty. */
export function resetNodeNitroSqlite(): void {
  for (const db of databases.values()) {
    db.close()
  }
  databases.clear()
  globalThis.__satsignerDb = undefined
}
