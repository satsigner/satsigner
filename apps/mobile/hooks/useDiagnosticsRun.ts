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

  function recordResult(result: DiagnosticResult) {
    setResults((previous) => upsertResult(previous, result))
    setRunningIds((previous) => previous.filter((id) => id !== result.id))
  }

  const mutation = useMutation({
    mutationFn: async (checks: DiagnosticCheck[]) => {
      setRunningIds(checks.map((check) => check.id))
      const ctx = await buildDiagnosticsContext()
      return runDiagnostics(checks, ctx, { onResult: recordResult })
    },
    onSettled: () => setRunningIds([])
  })

  return {
    isRunning: mutation.isPending,
    results,
    run: mutation.mutate,
    runningIds
  }
}
