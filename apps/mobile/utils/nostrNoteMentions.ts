import { nip19 } from 'nostr-tools'

import { type NostrKind0Profile } from '@/types/models/Nostr'

const MENTION_RE = /(?:nostr:)?(npub1[a-z0-9]{6,}|nprofile1[a-z0-9]{6,})/gi

function decodeMentionPubkey(bech32: string): string | null {
  try {
    const decoded = nip19.decode(bech32)
    if (decoded.type === 'npub') {
      return decoded.data as string
    }
    if (decoded.type === 'nprofile') {
      return (decoded.data as { pubkey: string }).pubkey
    }
    return null
  } catch {
    return null
  }
}

export function extractMentionPubkeys(content: string): string[] {
  const pubkeys: string[] = []
  const seen = new Set<string>()
  for (const match of content.matchAll(MENTION_RE)) {
    const [, bech32] = match
    if (!bech32) {
      continue
    }
    const pubkey = decodeMentionPubkey(bech32)
    if (pubkey && !seen.has(pubkey)) {
      seen.add(pubkey)
      pubkeys.push(pubkey)
    }
  }
  return pubkeys
}

export function resolveMentionsInContent(
  content: string,
  profiles: Record<string, NostrKind0Profile | null>
): string {
  return content.replace(MENTION_RE, (fullMatch, bech32: string) => {
    const pubkey = decodeMentionPubkey(bech32)
    if (!pubkey) {
      return fullMatch
    }
    const profile = profiles[pubkey]
    if (!profile) {
      return fullMatch
    }
    const name = profile.displayName?.trim()
    return name ? `@${name}` : fullMatch
  })
}
