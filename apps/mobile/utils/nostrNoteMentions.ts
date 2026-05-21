import { nip19 } from 'nostr-tools'

import { NOSTR_MENTION_RE } from '@/constants/nostr'
import { type NostrKind0Profile } from '@/types/models/Nostr'

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
  for (const match of content.matchAll(NOSTR_MENTION_RE)) {
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
  return content.replace(NOSTR_MENTION_RE, (fullMatch, bech32: string) => {
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
