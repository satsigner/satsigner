export type NitroSQLiteConnection = {
  close: () => void
  execute: (
    sql: string,
    params?: unknown[]
  ) => { insertId?: number; results: unknown[] }
}

export function open(_opts: { name: string }): NitroSQLiteConnection {
  return {
    close: jest.fn(),
    execute: jest.fn().mockReturnValue({ results: [] })
  }
}
