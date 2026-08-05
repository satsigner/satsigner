import {
  PAYJOIN_DEFAULT_COORDINATION_MODE,
  PAYJOIN_DIRECTORY_URL
} from '@/constants/payjoin'
import { type PayjoinCoordinationMode } from '@/types/payjoin'

const PAYJOIN_COORDINATION_MODES: readonly PayjoinCoordinationMode[] = [
  'directory',
  'manual'
]

function isPayjoinCoordinationMode(
  value: unknown
): value is PayjoinCoordinationMode {
  return (
    typeof value === 'string' &&
    (PAYJOIN_COORDINATION_MODES as readonly string[]).includes(value)
  )
}

function normalizePayjoinCoordinationMode(
  value: unknown
): PayjoinCoordinationMode {
  if (isPayjoinCoordinationMode(value)) {
    return value
  }
  return PAYJOIN_DEFAULT_COORDINATION_MODE
}

/**
 * Resolve the directory URL to use for a Payjoin session. A non-empty custom URL
 * always wins; an empty custom URL falls back to the default directory. Callers
 * that fail with a user-set custom URL must surface the error rather than
 * silently retrying against the default.
 */
function resolvePayjoinDirectoryUrl(customUrl: string | undefined): string {
  const trimmed = (customUrl ?? '').trim()
  if (trimmed.length > 0) {
    return trimmed.replace(/\/+$/, '')
  }
  return PAYJOIN_DIRECTORY_URL
}

function hasCustomPayjoinDirectoryUrl(customUrl: string | undefined): boolean {
  return (customUrl ?? '').trim().length > 0
}

export {
  hasCustomPayjoinDirectoryUrl,
  isPayjoinCoordinationMode,
  normalizePayjoinCoordinationMode,
  PAYJOIN_COORDINATION_MODES,
  resolvePayjoinDirectoryUrl
}
