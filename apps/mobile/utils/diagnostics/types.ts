import type { Network } from '@/types/settings/blockchain'

type DiagnosticCategory = 'app' | 'bitcoin' | 'nostr' | 'services' | 'storage'

type DiagnosticStatus = 'fail' | 'ok' | 'skipped' | 'warn'

type DiagnosticOutcome = {
  lines: string[]
  status: DiagnosticStatus
}

type DiagnosticsContext = {
  identityRelays: string[]
  isOnline: boolean
  network: Network
}

type DiagnosticCheck = {
  category: DiagnosticCategory
  id: string
  /** Left out of "Run full diagnostics"; runs only from its own button. */
  manualOnly?: boolean
  requiresNetwork?: boolean
  run: (ctx: DiagnosticsContext) => Promise<DiagnosticOutcome>
  timeoutMs?: number
}

type DiagnosticResult = DiagnosticOutcome & {
  category: DiagnosticCategory
  durationMs: number
  id: string
}

export type {
  DiagnosticCategory,
  DiagnosticCheck,
  DiagnosticOutcome,
  DiagnosticResult,
  DiagnosticStatus,
  DiagnosticsContext
}
