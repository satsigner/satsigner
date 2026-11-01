import { APP_CHECKS } from './checks/app'
import { BITCOIN_CHECKS } from './checks/bitcoin'
import { NOSTR_CHECKS } from './checks/nostr'
import { SERVICES_CHECKS } from './checks/services'
import { STORAGE_CHECKS } from './checks/storage'
import type { DiagnosticCategory, DiagnosticCheck } from './types'

const DIAGNOSTIC_CATEGORIES: DiagnosticCategory[] = [
  'app',
  'storage',
  'bitcoin',
  'nostr',
  'services'
]

const DIAGNOSTIC_CHECKS: DiagnosticCheck[] = [
  ...APP_CHECKS,
  ...STORAGE_CHECKS,
  ...BITCOIN_CHECKS,
  ...NOSTR_CHECKS,
  ...SERVICES_CHECKS
]

const FULL_RUN_CHECKS = DIAGNOSTIC_CHECKS.filter((check) => !check.manualOnly)

function getDiagnosticCheck(id: string): DiagnosticCheck | undefined {
  return DIAGNOSTIC_CHECKS.find((check) => check.id === id)
}

export { buildDiagnosticsContext } from './context'
export { resolveLiveRoundtripRelays } from './coreChecks'
export { formatDiagnosticsReport, redactLine } from './redact'
export { runDiagnosticCheck, runDiagnostics } from './runner'
export type {
  DiagnosticCategory,
  DiagnosticCheck,
  DiagnosticResult,
  DiagnosticStatus,
  DiagnosticsContext
} from './types'
export {
  DIAGNOSTIC_CATEGORIES,
  DIAGNOSTIC_CHECKS,
  FULL_RUN_CHECKS,
  getDiagnosticCheck
}
