import type { LndPendingChannelsResponse } from '@/types/lndNodeSettings'

export function formatLndVersion(version: string): string {
  const cleanVersion = version.replace(/[^0-9.]/g, '')
  const parts = cleanVersion.split('.').filter(Boolean)

  if (parts.length >= 3) {
    const isValidPattern = parts
      .slice(0, 3)
      .every((part) => /^[0-9]{1,2}$/.test(part))

    if (isValidPattern) {
      return parts.slice(0, 3).join('.')
    }
  }

  return '0.0.0'
}

export function formatBestHeaderUtc(bestHeaderTimestamp: string): string {
  const n = Number(bestHeaderTimestamp)
  if (!Number.isFinite(n) || n <= 0) {
    return '—'
  }
  const SECONDS_THRESHOLD = 1e12
  const ms = n < SECONDS_THRESHOLD ? n * 1000 : n
  return new Date(ms).toISOString()
}

export function getPendingCounts(p: LndPendingChannelsResponse | null) {
  if (!p) {
    return {
      closing: 0,
      forceClosing: 0,
      opening: 0,
      waitingClose: 0
    }
  }
  return {
    closing: p.pending_closing_channels?.length ?? 0,
    forceClosing: p.pending_force_closing_channels?.length ?? 0,
    opening: p.pending_open_channels?.length ?? 0,
    waitingClose: p.waiting_close_channels?.length ?? 0
  }
}
