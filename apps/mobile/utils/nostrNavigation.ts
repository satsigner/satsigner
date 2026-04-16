import { type Href } from 'expo-router'

export function nostrAccountProfileHref(npub: string): Href {
  return `/signer/nostr/account/${npub}` as Href
}

export function nostrAddIdentityHref(): Href {
  return '/signer/nostr/add' as Href
}

/** Expo typed routes omit query params; build href as string then assert once here. */
export function nostrNoteHref(npub: string, nostrUri: string): Href {
  return `/signer/nostr/account/${npub}/note?nostrUri=${encodeURIComponent(
    nostrUri
  )}` as Href
}

export function nostrAccountHref(
  npub: string,
  segment: 'chat' | 'compose' | 'keys' | 'relays' | 'send' | 'settings'
): Href {
  return `/signer/nostr/account/${npub}/${segment}` as Href
}
