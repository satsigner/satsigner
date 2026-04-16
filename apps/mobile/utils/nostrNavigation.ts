import { type Href } from 'expo-router'

export function nostrAccountProfileHref(npub: string): Href {
  return `/signer/nostr/account/${npub}` as Href
}

/** View `targetNpub`'s profile in the context of identity `ownerNpub`. */
export function nostrContactProfileHref(
  ownerNpub: string,
  targetNpub: string
): Href {
  return `/signer/nostr/account/${ownerNpub}/contact/${targetNpub}` as Href
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
  segment:
    | 'chat'
    | 'compose'
    | 'keys'
    | 'relays'
    | 'send'
    | 'settings'
    | 'zapSettings'
): Href {
  return `/signer/nostr/account/${npub}/${segment}` as Href
}

export function nostrZapDetailHref(npub: string, zapId: string): Href {
  return `/signer/nostr/account/${npub}/zap/${zapId}` as Href
}
