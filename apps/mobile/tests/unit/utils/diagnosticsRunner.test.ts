import {
  DIAGNOSTIC_CHECKS,
  FULL_RUN_CHECKS,
  type DiagnosticCheck,
  type DiagnosticsContext,
  runDiagnostics
} from '@/utils/diagnostics'

const ONLINE: DiagnosticsContext = {
  identityRelays: [],
  isOnline: true,
  network: 'signet'
}

function makeCheck(overrides: Partial<DiagnosticCheck> & { id: string }) {
  const check: DiagnosticCheck = {
    category: 'app',
    run: () => Promise.resolve({ lines: ['fine'], status: 'ok' }),
    ...overrides
  }
  return check
}

const hungChecks: unknown[] = []

describe('runDiagnostics', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns results in registry order and reports each one', async () => {
    const reported: string[] = []
    const results = await runDiagnostics(
      [
        makeCheck({
          id: 'slow',
          run: () =>
            new Promise((resolve) => {
              setTimeout(() => resolve({ lines: [], status: 'ok' }), 20)
            })
        }),
        makeCheck({ id: 'fast' })
      ],
      ONLINE,
      { concurrency: 2, onResult: (result) => reported.push(result.id) }
    )

    expect(results.map((result) => result.id)).toStrictEqual(['slow', 'fast'])
    expect(reported).toStrictEqual(['fast', 'slow'])
  })

  it('turns a throwing check into a failure without stopping the others', async () => {
    const results = await runDiagnostics(
      [
        makeCheck({
          id: 'boom',
          run: () => Promise.reject(new Error('kaput'))
        }),
        makeCheck({ id: 'after' })
      ],
      ONLINE
    )

    expect(results[0]).toMatchObject({
      id: 'boom',
      lines: ['error: kaput'],
      status: 'fail'
    })
    expect(results[1]?.status).toBe('ok')
  })

  it('fails a hung check at its timeout', async () => {
    jest.useFakeTimers()
    const pending = runDiagnostics(
      [
        makeCheck({
          id: 'hung',
          run: () =>
            new Promise((resolve) => {
              hungChecks.push(resolve)
            }),
          timeoutMs: 50
        })
      ],
      ONLINE
    )
    await jest.advanceTimersByTimeAsync(60)
    const [result] = await pending

    expect(result?.status).toBe('fail')
    expect(result?.lines[0]).toContain('timed out')
  })

  it('skips network checks when the device is offline', async () => {
    const run = jest.fn()
    const [result] = await runDiagnostics(
      [makeCheck({ id: 'net', requiresNetwork: true, run })],
      { ...ONLINE, isOnline: false }
    )

    expect(run).not.toHaveBeenCalled()
    expect(result?.status).toBe('skipped')
  })
})

describe('diagnostic registry', () => {
  it('has unique check ids', () => {
    const ids = DIAGNOSTIC_CHECKS.map((check) => check.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps the publishing NIP-17 live roundtrip out of the full run', () => {
    expect(FULL_RUN_CHECKS.map((check) => check.id)).not.toContain('nip17Live')
    expect(DIAGNOSTIC_CHECKS.map((check) => check.id)).toContain('nip17Live')
  })
})
