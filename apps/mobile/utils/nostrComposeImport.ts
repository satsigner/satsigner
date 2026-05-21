import { NOSTR_ZAP_TAG_NAMES } from '@/constants/nostr'
import { NostrKind1DraftImport } from '@/types/models/Nostr'

export function stripZapTags(tags: string[][]): string[][] {
  return tags.filter(
    (t) => typeof t[0] === 'string' && !NOSTR_ZAP_TAG_NAMES.has(t[0])
  )
}

/**
 * Only kind 1 is accepted; `id`, `sig`, `pubkey`, and `created_at` are ignored.
 */
export function parseKind1DraftFromJson(
  raw: string
): NostrKind1DraftImport | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const o = parsed as Record<string, unknown>
  const kind = typeof o.kind === 'number' ? o.kind : 1
  if (kind !== 1) {
    return null
  }
  if (typeof o.content !== 'string') {
    return null
  }

  const rawTags = o.tags
  if (rawTags !== undefined && !Array.isArray(rawTags)) {
    return null
  }

  const tags: string[][] = []
  if (Array.isArray(rawTags)) {
    for (const tag of rawTags) {
      if (!Array.isArray(tag) || !tag.every((x) => typeof x === 'string')) {
        return null
      }
      tags.push(tag)
    }
  }

  return { content: o.content, tags }
}
