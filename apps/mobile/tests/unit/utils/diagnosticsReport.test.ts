import type { DiagnosticResult } from '@/utils/diagnostics'
import {
  buildDiagnosticsReport,
  DIAGNOSTICS_REPORT_VERSION
} from '@/utils/diagnosticsReport'

function makeResult(
  overrides: Partial<DiagnosticResult> & Pick<DiagnosticResult, 'id'>
): DiagnosticResult {
  return {
    category: 'storage',
    durationMs: 5,
    lines: [],
    status: 'ok',
    ...overrides
  }
}

// The report is the one flow where diagnostic data leaves the device, so the
// builder's privacy contract (status + coarse environment only) is pinned
// here: log lines must never leak into the payload.
describe('buildDiagnosticsReport', () => {
  it('keeps only the status per check', () => {
    const payload = buildDiagnosticsReport(
      [
        makeResult({ id: 'crypto', lines: ['aes-256 roundtrip ok'] }),
        makeResult({ id: 'entropy', status: 'fail' }),
        makeResult({ id: 'lightning', status: 'skipped' })
      ],
      'signet'
    )

    expect(payload.checks).toStrictEqual({
      crypto: 'ok',
      entropy: 'fail',
      lightning: 'skipped'
    })
    expect(payload.network).toBe('signet')
  })

  it('never includes check log lines in the payload', () => {
    const sensitiveLine = 'wss://private-relay.example connected'
    const payload = buildDiagnosticsReport(
      [
        makeResult({
          category: 'nostr',
          id: 'nostrRelays',
          lines: [sensitiveLine],
          status: 'fail'
        }),
        makeResult({ id: 'secureStore', lines: ['write/read ok'] })
      ],
      'bitcoin'
    )

    expect(JSON.stringify(payload)).not.toContain(sensitiveLine)
    expect(JSON.stringify(payload)).not.toContain('write/read ok')
  })

  it('includes coarse environment info and the report schema version', () => {
    const payload = buildDiagnosticsReport([], 'testnet')

    expect(payload.v).toBe(DIAGNOSTICS_REPORT_VERSION)
    expect(typeof payload.app).toBe('string')
    expect(typeof payload.platform).toBe('string')
    expect(typeof payload.osVersion).toBe('string')
    expect(typeof payload.ts).toBe('number')
    expect(payload.checks).toStrictEqual({})
  })
})
