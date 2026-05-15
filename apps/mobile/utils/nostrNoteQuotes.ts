import { nip19 } from 'nostr-tools'

import type { NostrFeedNoteLike } from '@/components/SSNostrFeedNoteRow'
import { NOSTR_EVENT_REF_RE } from '@/constants/nostr'

type RawEvent = {
  content: string
  created_at: number
  id: string
  kind: number
  pubkey: string
  tags: unknown[]
}

function isRawEvent(value: unknown): value is RawEvent {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.content === 'string' &&
    typeof record.pubkey === 'string' &&
    typeof record.kind === 'number' &&
    typeof record.created_at === 'number' &&
    Array.isArray(record.tags)
  )
}

export function parseRepostOriginalEvent(
  content: string
): NostrFeedNoteLike | null {
  if (!content.trim()) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(content)
    if (!isRawEvent(parsed)) {
      return null
    }
    const tags = parsed.tags.filter((t): t is string[] => Array.isArray(t))
    return {
      content: parsed.content,
      created_at: parsed.created_at,
      id: parsed.id,
      kind: parsed.kind,
      pubkey: parsed.pubkey,
      tags
    }
  } catch {
    return null
  }
}

export function getRepostETagEventId(tags: string[][]): string | null {
  const eTag = tags.find((t) => t[0] === 'e')
  return typeof eTag?.[1] === 'string' ? eTag[1] : null
}

export function getQuoteTagEventIds(tags: string[][]): string[] {
  return tags
    .filter((t) => t[0] === 'q' && typeof t[1] === 'string')
    .map((t) => t[1])
}

export function hasEmbeddedEventRef(content: string): boolean {
  NOSTR_EVENT_REF_RE.lastIndex = 0
  return NOSTR_EVENT_REF_RE.test(content)
}

export function stripNostrEventRefs(content: string): string {
  return content
    .replace(NOSTR_EVENT_REF_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function decodeNostrEventRef(ref: string): string | null {
  try {
    const bech32 = ref.replace('nostr:', '')
    const decoded = nip19.decode(bech32)
    if (decoded.type === 'note') {
      return decoded.data
    }
    if (decoded.type === 'nevent') {
      return decoded.data.id
    }
    return null
  } catch {
    return null
  }
}

export function collectUnresolvedEventIds(
  notes: NostrFeedNoteLike[],
  alreadyResolved: Set<string>
): string[] {
  const ids = new Set<string>()

  for (const note of notes) {
    if (note.kind === 6 || note.kind === 16) {
      const parsed = parseRepostOriginalEvent(note.content)
      if (!parsed) {
        const fallbackId = getRepostETagEventId(note.tags)
        if (fallbackId && !alreadyResolved.has(fallbackId)) {
          ids.add(fallbackId)
        }
      }
    } else if (note.kind === 1) {
      const qIds = getQuoteTagEventIds(note.tags)
      if (qIds.length > 0) {
        for (const qId of qIds) {
          if (!alreadyResolved.has(qId)) {
            ids.add(qId)
          }
        }
      } else {
        const matches = note.content.match(NOSTR_EVENT_REF_RE) ?? []
        for (const ref of matches) {
          const id = decodeNostrEventRef(ref)
          if (id && !alreadyResolved.has(id)) {
            ids.add(id)
          }
        }
      }
    }
  }

  return Array.from(ids)
}

export function isNoteQuotePost(note: NostrFeedNoteLike): boolean {
  return (
    note.kind === 1 &&
    (getQuoteTagEventIds(note.tags).length > 0 ||
      hasEmbeddedEventRef(note.content))
  )
}

export function getResolvedEventId(note: NostrFeedNoteLike): string | null {
  if (note.kind === 6 || note.kind === 16) {
    const parsed = parseRepostOriginalEvent(note.content)
    if (parsed) {
      return null
    }
    return getRepostETagEventId(note.tags)
  }
  if (note.kind === 1) {
    const qIds = getQuoteTagEventIds(note.tags)
    if (qIds.length > 0) {
      return qIds[0]
    }
    const match = note.content.match(NOSTR_EVENT_REF_RE)?.[0]
    return match ? decodeNostrEventRef(match) : null
  }
  return null
}
