import { NOSTR_ZAP_TAG_NAMES } from '@/constants/nostr'
import { NostrKind1DraftImport } from '@/types/models/Nostr'
import { isRecord } from '@/utils/object'

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
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }

  if (!isRecord(parsed)) {
    return null
  }

  const kind = typeof parsed.kind === 'number' ? parsed.kind : 1
  if (kind !== 1) {
    return null
  }
  if (typeof parsed.content !== 'string') {
    return null
  }

  const rawTags = parsed.tags
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

  return { content: parsed.content, tags }
}
