import { type Href } from 'expo-router'

/** Expo typed routes omit query params; build href as string then assert once here. */
export function nostrNoteHref(npub: string, nostrUri: string): Href {
  return `/signer/nostr/account/${npub}/note?nostrUri=${encodeURIComponent(
    nostrUri
  )}` as Href
}

export function nostrAccountHref(
  npub: string,
  segment: 'compose' | 'keys' | 'relays' | 'send' | 'settings'
): Href {
  return `/signer/nostr/account/${npub}/${segment}` as Href
}
