import { type NostrKind0Profile } from '@/types/models/Nostr'

type CommonNostrKeys = {
  commonNpub: string
  commonNsec: string
}

export function kind0ProfileWithContent(
  profile: NostrKind0Profile | null | undefined
): NostrKind0Profile | null {
  if (!profile?.displayName && !profile?.picture) {
    return null
  }
  return profile
}

export function hasCommonNostrKeys<T extends object>(
  keys: T | undefined
): keys is T & CommonNostrKeys {
  return keys !== undefined && 'commonNsec' in keys && 'commonNpub' in keys
}
