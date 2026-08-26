import { type CheckResults } from '@/utils/diagnostics'
import {
  buildDiagnosticsReport,
  DIAGNOSTICS_REPORT_VERSION
} from '@/utils/diagnosticsReport'

// The report is the one flow where diagnostic data leaves the device, so the
// builder's privacy contract (pass/fail + coarse environment only) is pinned
// here: log lines must never leak into the payload.
describe('buildDiagnosticsReport', () => {
  it('keeps only pass/fail per check, excluding idle and running entries', () => {
    const results: CheckResults = {
      crypto: { kind: 'ok', lines: ['aes-256 roundtrip ok'] },
      entropy: { kind: 'failed', lines: ['3 uuid collisions'] },
      pinKdf: { kind: 'running' },
      secureStore: { kind: 'idle' }
    }

    const payload = buildDiagnosticsReport(results, 'signet')

    expect(payload.checks).toStrictEqual({ crypto: 'ok', entropy: 'failed' })
    expect(payload.network).toBe('signet')
  })

  it('never includes check log lines in the payload', () => {
    const sensitiveLine = 'wss://private-relay.example connected'
    const results: CheckResults = {
      relayPersistence: { kind: 'failed', lines: [sensitiveLine] },
      secureStore: { kind: 'ok', lines: ['write/read ok'] }
    }

    const payload = buildDiagnosticsReport(results, 'bitcoin')

    expect(JSON.stringify(payload)).not.toContain(sensitiveLine)
    expect(JSON.stringify(payload)).not.toContain('write/read ok')
  })

  it('includes coarse environment info and the report schema version', () => {
    const payload = buildDiagnosticsReport({}, 'testnet')

    expect(payload.v).toBe(DIAGNOSTICS_REPORT_VERSION)
    expect(typeof payload.app).toBe('string')
    expect(typeof payload.platform).toBe('string')
    expect(typeof payload.osVersion).toBe('string')
    expect(typeof payload.ts).toBe('number')
    expect(payload.checks).toStrictEqual({})
  })
})
