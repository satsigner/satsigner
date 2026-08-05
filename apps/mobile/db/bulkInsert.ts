import {
  type NitroSQLiteConnection,
  type SQLiteValue
} from 'react-native-nitro-sqlite'

/**
 * SQLite compiled with SQLITE_MAX_VARIABLE_NUMBER = 32766. Chunking keeps each
 * multi-row INSERT under that ceiling.
 */
const MAX_SQL_VARIABLES = 32766

/**
 * Insert many rows using multi-row VALUES statements instead of one statement
 * per row, which collapses the per-statement JSI round trips.
 *
 * Runs plain `execute` calls so it stays inside the caller's transaction —
 * nitro-sqlite's `executeBatch` opens its own `BEGIN EXCLUSIVE`, which cannot
 * nest inside `runTransaction`.
 */
function bulkInsert(
  tx: NitroSQLiteConnection,
  sqlPrefix: string,
  columnCount: number,
  rows: SQLiteValue[][]
) {
  if (rows.length === 0) {
    return
  }

  const rowsPerChunk = Math.max(1, Math.floor(MAX_SQL_VARIABLES / columnCount))
  const placeholder = `(${Array.from({ length: columnCount }, () => '?').join(
    ', '
  )})`

  for (let start = 0; start < rows.length; start += rowsPerChunk) {
    const chunk = rows.slice(start, start + rowsPerChunk)
    const valuesClause = Array.from(
      { length: chunk.length },
      () => placeholder
    ).join(', ')
    tx.execute(`${sqlPrefix} VALUES ${valuesClause}`, chunk.flat())
  }
}

export { bulkInsert }
