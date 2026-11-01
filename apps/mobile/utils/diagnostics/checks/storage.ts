import {
  DIAGNOSTIC_MMKV_TOP_KEYS,
  DIAGNOSTIC_NOSTR_STORE_WARN_BYTES
} from '@/constants/diagnostics'
import { getDb } from '@/db/connection'
import { DB_SCHEMA_VERSION, getSchemaVersion } from '@/db/schema'
import { getMmkvKeyStats, probeMmkvRoundtrip } from '@/storage/mmkv'

import {
  checkCryptoRoundtrip,
  checkEntropyCollisions,
  checkPinKdf,
  checkSecureStore,
  checkSqlite,
  type LegacyDiagnosticResult
} from '../coreChecks'
import type { DiagnosticCheck, DiagnosticOutcome } from '../types'

const NOSTR_STORE_KEY = 'satsigner-nostr'
const BYTES_PER_KB = 1024

function fromLegacy(result: LegacyDiagnosticResult): DiagnosticOutcome {
  return { lines: result.lines, status: result.ok ? 'ok' : 'fail' }
}

function formatKb(bytes: number): string {
  return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`
}

const cryptoCheck: DiagnosticCheck = {
  category: 'storage',
  id: 'crypto',
  run: async () => fromLegacy(await checkCryptoRoundtrip())
}

const entropyCheck: DiagnosticCheck = {
  category: 'storage',
  id: 'entropy',
  run: async () => fromLegacy(await checkEntropyCollisions())
}

const pinKdfCheck: DiagnosticCheck = {
  category: 'storage',
  id: 'pinKdf',
  run: async () => fromLegacy(await checkPinKdf())
}

const secureStoreCheck: DiagnosticCheck = {
  category: 'storage',
  id: 'secureStore',
  run: async () => fromLegacy(await checkSecureStore())
}

const sqliteCheck: DiagnosticCheck = {
  category: 'storage',
  id: 'sqlite',
  run: async () => fromLegacy(await checkSqlite())
}

const schemaVersionCheck: DiagnosticCheck = {
  category: 'storage',
  id: 'schemaVersion',
  run() {
    const version = getSchemaVersion(getDb())
    const lines = [`schema v${version} (expected v${DB_SCHEMA_VERSION})`]
    return Promise.resolve({
      lines,
      status: version === DB_SCHEMA_VERSION ? 'ok' : 'fail'
    })
  }
}

const tableRowCountsCheck: DiagnosticCheck = {
  category: 'storage',
  id: 'tableRowCounts',
  run() {
    const db = getDb()
    const tables = db
      .execute<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .rows._array.map((row) => row.name)
    const lines = tables.map((table) => {
      const count =
        db
          .execute<{ n: number }>(`SELECT COUNT(*) AS n FROM "${table}"`)
          .rows.item(0)?.n ?? 0
      return `${table}: ${count}`
    })
    return Promise.resolve({ lines, status: 'ok' })
  }
}

const mmkvCheck: DiagnosticCheck = {
  category: 'storage',
  id: 'mmkv',
  run() {
    const roundtrip = probeMmkvRoundtrip()
    const stats = getMmkvKeyStats()
    const totalBytes = stats.reduce((sum, stat) => sum + stat.bytes, 0)
    const nostrBytes =
      stats.find((stat) => stat.key === NOSTR_STORE_KEY)?.bytes ?? 0
    const lines = [
      `write/read/delete ${roundtrip ? 'ok' : 'FAILED'}`,
      `${stats.length} keys, ${formatKb(totalBytes)} total`,
      ...stats
        .slice(0, DIAGNOSTIC_MMKV_TOP_KEYS)
        .map((stat) => `  ${stat.key}: ${formatKb(stat.bytes)}`)
    ]
    if (!roundtrip) {
      return Promise.resolve({ lines, status: 'fail' })
    }
    if (nostrBytes > DIAGNOSTIC_NOSTR_STORE_WARN_BYTES) {
      return Promise.resolve({
        lines: [...lines, `${NOSTR_STORE_KEY} is unusually large`],
        status: 'warn'
      })
    }
    return Promise.resolve({ lines, status: 'ok' })
  }
}

const STORAGE_CHECKS = [
  cryptoCheck,
  entropyCheck,
  pinKdfCheck,
  secureStoreCheck,
  sqliteCheck,
  schemaVersionCheck,
  tableRowCountsCheck,
  mmkvCheck
]

export { STORAGE_CHECKS }
