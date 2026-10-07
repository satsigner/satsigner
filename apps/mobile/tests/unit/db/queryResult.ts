import {
  type QueryResult,
  type QueryResultRow
} from 'react-native-nitro-sqlite'

/**
 * Builds what nitro-sqlite's execute() returns for `results`, including the
 * `rows` view its JS wrapper derives from them. Tests hand it to a mocked
 * execute(); the nitro-sqlite mock uses it for its default empty result.
 */
export function mockQueryResult<Row extends QueryResultRow>(
  results: Row[] = []
): QueryResult<Row> {
  return {
    dispose: () => undefined,
    equals: () => false,
    name: 'NitroSQLiteQueryResult',
    results,
    rows: {
      _array: results,
      item: (idx) => results[idx],
      length: results.length
    },
    rowsAffected: 0,
    toString: () => 'NitroSQLiteQueryResult'
  }
}
