import type { MemPoolFees } from '@/types/models/Blockchain'

/** Parse unknown Esplora `/fee-estimates` JSON into numeric confirmation targets. */
export function parseEsploraFeeEstimates(
  raw: unknown
): Record<string, number> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }

  const estimates: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      estimates[key] = value
    }
  }

  return Object.keys(estimates).length > 0 ? estimates : null
}

/** Map Esplora `/fee-estimates` confirmation targets to explorer fee tiers. */
export function feesFromEsploraEstimates(
  estimates: Record<string, number>
): MemPoolFees | null {
  function rate(key: string): number | null {
    const value = estimates[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  const high = rate('1') ?? rate('2')
  if (high === null) {
    return null
  }

  return {
    high: Math.round(high),
    low: Math.round(rate('6') ?? rate('12') ?? high),
    medium: Math.round(rate('3') ?? rate('6') ?? high),
    none: Math.round(rate('144') ?? rate('504') ?? 1)
  }
}

/** Validate unknown Esplora fee-estimates payload and map to explorer fee tiers. */
export function feesFromUnknownEsploraEstimates(
  raw: unknown
): MemPoolFees | null {
  const estimates = parseEsploraFeeEstimates(raw)
  if (!estimates) {
    return null
  }
  return feesFromEsploraEstimates(estimates)
}
