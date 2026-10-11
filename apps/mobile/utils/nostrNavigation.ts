import { type Href } from 'expo-router'

export function nostrAccountProfileHref(npub: string): Href {
  return { params: { npub }, pathname: '/signer/nostr/account/[npub]' }
}

/** View `targetNpub`'s profile in the context of identity `ownerNpub`. */
export function nostrContactProfileHref(
  ownerNpub: string,
  targetNpub: string
): Href {
  return {
    params: { npub: ownerNpub, targetNpub },
    pathname: '/signer/nostr/account/[npub]/contact/[targetNpub]'
  }
}

export function nostrIndexHref(): Href {
  return '/signer/nostr'
}

export function nostrAddIdentityHref(): Href {
  return '/signer/nostr/add'
}

export function nostrGlobalRelaysHref(): Href {
  return '/signer/nostr/relays'
}

/**
 * Note screen for `nostrUri` (a `nostr:` URI or bech32 such as note1/nevent1),
 * viewed as identity `npub`.
 */
export function nostrNoteHref(npub: string, nostrUri: string): Href {
  return {
    params: { nostrUri, npub },
    pathname: '/signer/nostr/account/[npub]/note'
  }
}

export function nostrAccountHref(
  npub: string,
  segment:
    | 'blossom'
    | 'bunker'
    | 'cache'
    | 'calendar'
    | 'chat'
    | 'compose'
    | 'contacts'
    | 'files'
    | 'keys'
    | 'profile'
    | 'relays'
    | 'send'
    | 'settings'
    | 'zapSettings'
): Href {
  return {
    params: { npub },
    pathname: `/signer/nostr/account/[npub]/${segment}`
  }
}

/** Bunker screen of `npub`, previewing a scanned `nostrconnect://` URI. */
export function nostrBunkerConnectHref(npub: string, connectUri: string): Href {
  return {
    params: { connectUri, npub },
    pathname: '/signer/nostr/account/[npub]/bunker'
  }
}

export function nostrFileDetailHref(npub: string, sha256: string): Href {
  return {
    params: { npub, sha256 },
    pathname: '/signer/nostr/account/[npub]/files/[sha256]'
  }
}

export function nostrZapDetailHref(npub: string, zapId: string): Href {
  return {
    params: { npub, zapId },
    pathname: '/signer/nostr/account/[npub]/zap/[zapId]'
  }
}
