import { bytesToHex } from '@noble/hashes/utils'
import QuickCrypto from 'react-native-quick-crypto'

import {
  NOSTR_BUNKER_TAG,
  NOSTR_NIP46_BUNKER_PREFIX,
  NOSTR_NIP46_DEFAULT_PERMISSIONS,
  NOSTR_NIP46_OFFER_SECRET_BYTES,
  NOSTR_NIP46_OFFER_TTL_MS
} from '@/constants/nostr'
import type {
  Nip46IncomingRequest,
  Nip46Session,
  Nip46SessionOrigin
} from '@/types/models/Nostr'
import { randomUuid } from '@/utils/crypto'

type BunkerOffer = {
  session: Nip46Session
  url: string
}

function buildBunkerUrl(
  signerPubkeyHex: string,
  relays: string[],
  secret: string
): string {
  const query = new URLSearchParams()
  for (const relay of relays) {
    query.append('relay', relay)
  }
  query.append('secret', secret)
  return `${NOSTR_NIP46_BUNKER_PREFIX}${signerPubkeyHex}?${query.toString()}`
}

/**
 * A `bunker://` link for one identity. The session has no client yet: the
 * first `connect` carrying the secret claims it, and the secret is spent.
 */
function createBunkerOffer({
  nowMs,
  origin,
  relays,
  signerNpub,
  signerPubkeyHex
}: {
  nowMs: number
  origin: Nip46SessionOrigin
  relays: string[]
  signerNpub: string
  signerPubkeyHex: string
}): BunkerOffer {
  const secret = bytesToHex(
    Uint8Array.from(QuickCrypto.randomBytes(NOSTR_NIP46_OFFER_SECRET_BYTES))
  )
  return {
    session: {
      clientPubkey: '',
      createdAt: nowMs,
      expiresAt: nowMs + NOSTR_NIP46_OFFER_TTL_MS,
      id: randomUuid(),
      lastActiveAt: nowMs,
      origin,
      permissions: { ...NOSTR_NIP46_DEFAULT_PERMISSIONS },
      relays,
      secret,
      signerNpub
    },
    url: buildBunkerUrl(signerPubkeyHex, relays, secret)
  }
}

function isOpenBunkerOffer(session: Nip46Session): boolean {
  return session.clientPubkey === ''
}

/** Compares without leaking, through timing, how much of the secret matched. */
function secretsMatch(given: string, expected: string): boolean {
  if (given.length !== expected.length || expected.length === 0) {
    return false
  }
  const mismatch = [...expected].reduce(
    (diff, char, index) =>
      diff | ((char.codePointAt(0) ?? 0) ^ (given.codePointAt(index) ?? 0)),
    0
  )
  return mismatch === 0
}

/**
 * Whether a request claims an open offer: a `connect` naming our key with
 * the offer's secret, before the offer expires.
 */
function claimsBunkerOffer(
  session: Nip46Session,
  request: Nip46IncomingRequest,
  signerPubkeyHex: string,
  nowMs: number
): boolean {
  const [remoteSignerPubkey = '', secret = ''] = request.params
  return (
    isOpenBunkerOffer(session) &&
    request.method === 'connect' &&
    remoteSignerPubkey === signerPubkeyHex &&
    session.secret !== undefined &&
    secretsMatch(secret, session.secret) &&
    (session.expiresAt === undefined || nowMs < session.expiresAt)
  )
}

function buildBunkerOfferTags(url: string): string[][] {
  return [[NOSTR_BUNKER_TAG, url]]
}

export {
  buildBunkerOfferTags,
  buildBunkerUrl,
  claimsBunkerOffer,
  createBunkerOffer,
  isOpenBunkerOffer,
  secretsMatch
}
export type { BunkerOffer }
