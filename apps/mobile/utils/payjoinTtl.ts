import {
  PAYJOIN_SESSION_TTL_MS,
  PAYJOIN_SESSION_TTL_PRESETS_MS
} from '@/constants/payjoin'

function isPayjoinSessionTtlPreset(ms: number): boolean {
  return (PAYJOIN_SESSION_TTL_PRESETS_MS as readonly number[]).includes(ms)
}

function normalizePayjoinSessionTtlMs(ms: number | undefined): number {
  if (ms !== undefined && isPayjoinSessionTtlPreset(ms)) {
    return ms
  }
  return PAYJOIN_SESSION_TTL_MS
}

export { isPayjoinSessionTtlPreset, normalizePayjoinSessionTtlMs }
