import {
  FULL_ADDRESS_CHECK_AFTER_MS,
  QUICK_CHECK_MAX_ADDRESSES,
  QUICK_CHECK_MIN_ADDRESSES
} from '@/constants/sync'
import { getSyncScope } from '@/utils/accountSync'

const NOW_MS = Date.UTC(2026, 10, 16)

function scopeAfter(elapsedMs: number) {
  return getSyncScope({
    lastSyncedAt: new Date(NOW_MS - elapsedMs),
    nowMs: NOW_MS
  })
}

describe('getSyncScope', () => {
  it('checks all addresses when the account never synced', () => {
    expect(
      getSyncScope({ lastSyncedAt: undefined, nowMs: NOW_MS })
    ).toStrictEqual({
      kind: 'all'
    })
  })

  it('checks the minimum right after a sync', () => {
    expect(scopeAfter(0)).toStrictEqual({
      kind: 'recent',
      recentPerKeychain: QUICK_CHECK_MIN_ADDRESSES
    })
  })

  it('treats a sync dated in the future as just synced', () => {
    expect(scopeAfter(-60_000)).toStrictEqual({
      kind: 'recent',
      recentPerKeychain: QUICK_CHECK_MIN_ADDRESSES
    })
  })

  it('grows the range linearly with the gap', () => {
    expect(scopeAfter(FULL_ADDRESS_CHECK_AFTER_MS / 2)).toStrictEqual({
      kind: 'recent',
      recentPerKeychain: Math.round(
        (QUICK_CHECK_MIN_ADDRESSES + QUICK_CHECK_MAX_ADDRESSES) / 2
      )
    })
  })

  it('stays partial just before two weeks', () => {
    expect(scopeAfter(FULL_ADDRESS_CHECK_AFTER_MS - 60 * 60_000).kind).toBe(
      'recent'
    )
  })

  it('checks all addresses after two weeks', () => {
    expect(scopeAfter(FULL_ADDRESS_CHECK_AFTER_MS)).toStrictEqual({
      kind: 'all'
    })
  })

  it('checks all addresses when the last sync date is invalid', () => {
    expect(
      getSyncScope({ lastSyncedAt: new Date('invalid'), nowMs: NOW_MS })
    ).toStrictEqual({ kind: 'all' })
  })
})
