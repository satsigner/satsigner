import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import {
  buildDiagnosticsContext,
  type DiagnosticCheck,
  type DiagnosticResult,
  runDiagnostics
} from '@/utils/diagnostics'

function upsertResult(
  results: DiagnosticResult[],
  next: DiagnosticResult
): DiagnosticResult[] {
  return [...results.filter((result) => result.id !== next.id), next]
}

/**
 * Runs diagnostic checks and keeps every finished result, so a full run and
 * single re-runs build up one report.
 */
export function useDiagnosticsRun() {
  const [results, setResults] = useState<DiagnosticResult[]>([])
  const [runningIds, setRunningIds] = useState<string[]>([])
  const [runError, setRunError] = useState<string | null>(null)
  const [runProgress, setRunProgress] = useState({ done: 0, total: 0 })

  function recordResult(result: DiagnosticResult) {
    setResults((previous) => upsertResult(previous, result))
    setRunningIds((previous) => previous.filter((id) => id !== result.id))
    setRunProgress((previous) => ({ ...previous, done: previous.done + 1 }))
  }

  const mutation = useMutation({
    mutationFn: async (checks: DiagnosticCheck[]) => {
      setRunError(null)
      setRunProgress({ done: 0, total: checks.length })
      setRunningIds(checks.map((check) => check.id))
      try {
        const ctx = await buildDiagnosticsContext()
        return await runDiagnostics(checks, ctx, { onResult: recordResult })
      } catch (error) {
        setRunError(
          error instanceof Error ? error.message : 'diagnostics failed'
        )
        throw error
      }
    },
    onSettled: () => setRunningIds([]),
    scope: { id: 'diagnostics' }
  })

  return {
    isRunning: mutation.isPending,
    results,
    run: mutation.mutate,
    runError,
    runProgress,
    runningIds
  }
}
