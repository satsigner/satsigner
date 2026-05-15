import {
  decrypt as nip04Decrypt,
  encrypt as nip04Encrypt
} from 'nostr-tools/nip04'

export type BookmarkSource = 'public' | 'private'

export type ParsedBookmark = {
  eventId: string
  source: BookmarkSource
}

export function parsePublicBookmarks(tags: string[][]): ParsedBookmark[] {
  const result: ParsedBookmark[] = []
  for (const tag of tags) {
    if (tag[0] === 'e' && typeof tag[1] === 'string' && tag[1].length === 64) {
      result.push({ eventId: tag[1], source: 'public' })
    }
  }
  return result
}

export function decryptPrivateBookmarks(
  content: string,
  secretKey: Uint8Array,
  pubkeyHex: string
): ParsedBookmark[] {
  if (!content) {
    return []
  }
  try {
    const decrypted = nip04Decrypt(secretKey, pubkeyHex, content)
    const parsed = JSON.parse(decrypted) as string[][]
    const result: ParsedBookmark[] = []
    for (const tag of parsed) {
      if (
        tag[0] === 'e' &&
        typeof tag[1] === 'string' &&
        tag[1].length === 64
      ) {
        result.push({ eventId: tag[1], source: 'private' })
      }
    }
    return result
  } catch {
    return []
  }
}

export function mergeBookmarks(
  pub: ParsedBookmark[],
  priv: ParsedBookmark[]
): ParsedBookmark[] {
  const seen = new Set<string>()
  const result: ParsedBookmark[] = []
  for (const bm of pub) {
    if (!seen.has(bm.eventId)) {
      seen.add(bm.eventId)
      result.push(bm)
    }
  }
  for (const bm of priv) {
    if (!seen.has(bm.eventId)) {
      seen.add(bm.eventId)
      result.push(bm)
    }
  }
  return result
}

export function encryptPrivateBookmarks(
  eventIds: string[],
  secretKey: Uint8Array,
  pubkeyHex: string
): string {
  if (eventIds.length === 0) {
    return ''
  }
  const tags = eventIds.map((id) => ['e', id])
  return nip04Encrypt(secretKey, pubkeyHex, JSON.stringify(tags))
}

/**
 * Builds the updated tags and content for a kind 10003 bookmark event
 * after applying an add or remove operation.
 */
export function applyBookmarkUpdate(
  existing: { tags: string[][]; content: string } | null,
  action:
    | { type: 'add'; eventId: string; source: BookmarkSource }
    | { type: 'remove'; eventId: string },
  secretKey: Uint8Array | null,
  pubkeyHex: string
): { tags: string[][]; content: string } {
  const pubIds = existing
    ? parsePublicBookmarks(existing.tags).map((b) => b.eventId)
    : []
  const privIds =
    existing && secretKey && existing.content
      ? decryptPrivateBookmarks(existing.content, secretKey, pubkeyHex).map(
          (b) => b.eventId
        )
      : []

  const pubSet = new Set(pubIds)
  const privSet = new Set(privIds)

  if (action.type === 'add') {
    if (action.source === 'public') {
      privSet.delete(action.eventId)
      pubSet.add(action.eventId)
    } else {
      pubSet.delete(action.eventId)
      privSet.add(action.eventId)
    }
  } else {
    pubSet.delete(action.eventId)
    privSet.delete(action.eventId)
  }

  const tags = Array.from(pubSet).map((id) => ['e', id])
  const content =
    privSet.size > 0 && secretKey
      ? encryptPrivateBookmarks(Array.from(privSet), secretKey, pubkeyHex)
      : ''

  return { content, tags }
}
