import {
  type BrantaLookupMode,
  BrantaLookupModeSchema
} from '@/types/models/Branta'

const DEFAULT_BRANTA_LOOKUP_MODE: BrantaLookupMode = 'off'

/** An unreadable stored mode falls back to off, never to a mode that looks up. */
function normalizeBrantaLookupMode(value: unknown): BrantaLookupMode {
  const parsed = BrantaLookupModeSchema.safeParse(value)
  if (!parsed.success) {
    return DEFAULT_BRANTA_LOOKUP_MODE
  }
  return parsed.data
}

export { DEFAULT_BRANTA_LOOKUP_MODE, normalizeBrantaLookupMode }
