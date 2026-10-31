import {
  NOSTR_HEX_PUBKEY_RE,
  NOSTR_VISIBLE_WINDOW_AHEAD,
  NOSTR_VISIBLE_WINDOW_BEHIND
} from '@/constants/nostr'

type VisibleWindowRange = { end: number; start: number }

/**
 * Index range to load for: the visible rows plus a few ahead (scroll
 * direction) and behind. Null when nothing is visible.
 */
function getVisibleWindowRange(
  visibleIndices: number[],
  itemCount: number,
  ahead = NOSTR_VISIBLE_WINDOW_AHEAD,
  behind = NOSTR_VISIBLE_WINDOW_BEHIND
): VisibleWindowRange | null {
  if (visibleIndices.length === 0 || itemCount === 0) {
    return null
  }
  const first = Math.min(...visibleIndices)
  const last = Math.max(...visibleIndices)
  return {
    end: Math.min(itemCount - 1, last + ahead),
    start: Math.max(0, first - behind)
  }
}

/** Unique, valid lowercase hex pubkeys referenced by the items in range. */
function collectWindowPubkeys<T>(
  items: T[],
  range: VisibleWindowRange | null,
  getPubkeys: (item: T) => string[]
): string[] {
  if (!range) {
    return []
  }
  const pubkeys = items
    .slice(range.start, range.end + 1)
    .flatMap(getPubkeys)
    .map((pk) => pk.toLowerCase())
    .filter((pk) => NOSTR_HEX_PUBKEY_RE.test(pk))
  return [...new Set(pubkeys)]
}

export { collectWindowPubkeys, getVisibleWindowRange }
export type { VisibleWindowRange }
