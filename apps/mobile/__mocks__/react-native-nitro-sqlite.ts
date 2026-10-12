import { mockQueryResult } from '../tests/unit/db/queryResult'

export type NitroSQLiteConnection = {
  close: () => void
  execute: (
    sql: string,
    params?: unknown[]
  ) => ReturnType<typeof mockQueryResult>
}

export function open(_opts: { name: string }): NitroSQLiteConnection {
  return {
    close: jest.fn(),
    execute: jest.fn().mockReturnValue(mockQueryResult())
  }
}
