import { decrypt as nip04Decrypt } from 'nostr-tools/nip04'

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
