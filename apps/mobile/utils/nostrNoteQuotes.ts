import { nip19 } from 'nostr-tools'

import type { NostrFeedNoteLike } from '@/components/SSNostrFeedNoteRow'

const NOSTR_EVENT_REF_RE = /nostr:(note1|nevent1)[a-zA-Z0-9]+/g

export function parseRepostOriginalEvent(
  content: string
): NostrFeedNoteLike | null {
  if (!content.trim()) {
    return null
  }
  try {
    const raw = JSON.parse(content) as Record<string, unknown>
    if (
      typeof raw.id !== 'string' ||
      typeof raw.content !== 'string' ||
      typeof raw.pubkey !== 'string' ||
      typeof raw.kind !== 'number' ||
      typeof raw.created_at !== 'number' ||
      !Array.isArray(raw.tags)
    ) {
      return null
    }
    return {
      content: raw.content,
      created_at: raw.created_at,
      id: raw.id,
      kind: raw.kind,
      pubkey: raw.pubkey,
      tags: (raw.tags as unknown[]).filter(Array.isArray) as string[][]
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
