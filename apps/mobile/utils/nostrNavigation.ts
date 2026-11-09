import { type Href } from 'expo-router'

import { type NostrChatProtocol } from '@/types/models/Nostr'

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

/** Own profile when `authorNpub` is identity `ownerNpub`, otherwise the author's contact profile. */
export function nostrAuthorProfileHref(
  ownerNpub: string,
  authorNpub: string
): Href {
  if (authorNpub === ownerNpub) {
    return nostrAccountProfileHref(ownerNpub)
  }
  return nostrContactProfileHref(ownerNpub, authorNpub)
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

export function nostrChatThreadHref(
  npub: string,
  peerNpub: string,
  protocol: NostrChatProtocol
): Href {
  return {
    params: { npub, peer: peerNpub, protocol },
    pathname: '/signer/nostr/account/[npub]/chat/[peer]'
  }
}

/** Detail page of one message in identity `npub`'s chat with `peerNpub`. */
export function nostrChatMessageHref(
  npub: string,
  peerNpub: string,
  messageId: string
): Href {
  return {
    params: { messageId, npub, peer: peerNpub },
    pathname: '/signer/nostr/account/[npub]/chat/message/[messageId]'
  }
}

export function deviceGroupChatHref(accountId: string): Href {
  return {
    params: { id: accountId },
    pathname: '/signer/bitcoin/account/[id]/settings/nostr/devicesGroupChat'
  }
}

/** Detail page of one message in a bitcoin account's devices group chat. */
export function deviceChatMessageHref(
  accountId: string,
  messageId: string
): Href {
  return {
    params: { id: accountId, messageId },
    pathname: '/signer/bitcoin/account/[id]/settings/nostr/message/[messageId]'
  }
}
