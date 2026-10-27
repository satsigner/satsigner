import {
  DIAGNOSTIC_CHECK_TIMEOUT_MS,
  DIAGNOSTIC_CONCURRENCY
} from '@/constants/diagnostics'
import { range } from '@/utils/array'
import { withTimeout } from '@/utils/time'

import type {
  DiagnosticCheck,
  DiagnosticOutcome,
  DiagnosticResult,
  DiagnosticsContext
} from './types'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function failedOutcome(error: unknown): DiagnosticOutcome {
  return { lines: [`error: ${errorMessage(error)}`], status: 'fail' }
}

async function runCheckOutcome(
  check: DiagnosticCheck,
  ctx: DiagnosticsContext
): Promise<DiagnosticOutcome> {
  if (check.requiresNetwork && !ctx.isOnline) {
    return { lines: ['device is offline'], status: 'skipped' }
  }
  const timeoutMs = check.timeoutMs ?? DIAGNOSTIC_CHECK_TIMEOUT_MS
  try {
    return await withTimeout(
      check.run(ctx),
      timeoutMs,
      `timed out after ${timeoutMs}ms`
    )
  } catch (error) {
    return failedOutcome(error)
  }
}

/** Runs one check; never throws, a hung check fails at its timeout. */
async function runDiagnosticCheck(
  check: DiagnosticCheck,
  ctx: DiagnosticsContext
): Promise<DiagnosticResult> {
  const startedAt = Date.now()
  const outcome = await runCheckOutcome(check, ctx)
  return {
    ...outcome,
    category: check.category,
    durationMs: Date.now() - startedAt,
    id: check.id
  }
}

type RunDiagnosticsOptions = {
  concurrency?: number
  onResult?: (result: DiagnosticResult) => void
}

/**
 * Runs checks with bounded concurrency. Results come back in registry order;
 * `onResult` reports each one as soon as it finishes.
 */
async function runDiagnostics(
  checks: DiagnosticCheck[],
  ctx: DiagnosticsContext,
  { concurrency = DIAGNOSTIC_CONCURRENCY, onResult }: RunDiagnosticsOptions = {}
): Promise<DiagnosticResult[]> {
  const queue = [...checks]
  const results = new Map<string, DiagnosticResult>()

  async function drainQueue(): Promise<void> {
    const next = queue.shift()
    if (!next) {
      return
    }
    const result = await runDiagnosticCheck(next, ctx)
    results.set(next.id, result)
    onResult?.(result)
    return drainQueue()
  }

  await Promise.all(
    range(Math.min(concurrency, checks.length)).map(() => drainQueue())
  )
  return checks.flatMap((check) => {
    const result = results.get(check.id)
    return result ? [result] : []
  })
}

export { runDiagnosticCheck, runDiagnostics }
