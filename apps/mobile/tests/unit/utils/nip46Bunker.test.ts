import {
  NOSTR_NIP46_OFFER_TTL_MS,
  NOSTR_NIP46_DEFAULT_PERMISSIONS
} from '@/constants/nostr'
import {
  buildBunkerOfferTags,
  claimsBunkerOffer,
  createBunkerOffer,
  isOpenBunkerOffer,
  secretsMatch
} from '@/utils/nip46Bunker'

const SIGNER_HEX = 'a'.repeat(64)
const NOW = 1_800_000_000_000

function offer() {
  return createBunkerOffer({
    nowMs: NOW,
    origin: {
      kind: 'chat',
      peerPubkey: 'b'.repeat(64),
      sessionId: 'c'.repeat(32)
    },
    relays: ['wss://relay.one', 'wss://relay.two'],
    signerNpub: 'npub1signer',
    signerPubkeyHex: SIGNER_HEX
  })
}

function connect(secret: string, signer = SIGNER_HEX) {
  return { id: 'r1', method: 'connect', params: [signer, secret] }
}

describe('createBunkerOffer', () => {
  it('builds a bunker link with every relay and a fresh secret', () => {
    const { session, url } = offer()
    const parsed = new URL(url.replace('bunker://', 'https://'))

    expect(url.startsWith(`bunker://${SIGNER_HEX}?`)).toBe(true)
    expect(parsed.searchParams.getAll('relay')).toStrictEqual([
      'wss://relay.one',
      'wss://relay.two'
    ])
    expect(parsed.searchParams.get('secret')).toBe(session.secret)
    expect(session.secret).toMatch(/^[0-9a-f]{64}$/)
    expect(offer().session.secret).not.toBe(session.secret)
  })

  it('is an open offer for the chat session, expiring after the ttl', () => {
    const { session } = offer()

    expect(isOpenBunkerOffer(session)).toBe(true)
    expect(session).toMatchObject({
      expiresAt: NOW + NOSTR_NIP46_OFFER_TTL_MS,
      origin: { kind: 'chat', sessionId: 'c'.repeat(32) },
      permissions: NOSTR_NIP46_DEFAULT_PERMISSIONS
    })
  })

  it('carries the link in a bunker tag', () => {
    expect(buildBunkerOfferTags('bunker://x')).toStrictEqual([
      ['bunker', 'bunker://x']
    ])
  })
})

describe('claimsBunkerOffer', () => {
  it('is claimed by a connect with the secret, in time', () => {
    const { session } = offer()

    expect(
      claimsBunkerOffer(session, connect(session.secret ?? ''), SIGNER_HEX, NOW)
    ).toBe(true)
  })

  it('is not claimed with a wrong secret, signer or method', () => {
    const { session } = offer()
    const secret = session.secret ?? ''

    expect(
      claimsBunkerOffer(session, connect('0'.repeat(64)), SIGNER_HEX, NOW)
    ).toBe(false)
    expect(
      claimsBunkerOffer(
        session,
        connect(secret, 'f'.repeat(64)),
        SIGNER_HEX,
        NOW
      )
    ).toBe(false)
    expect(
      claimsBunkerOffer(
        session,
        { ...connect(secret), method: 'sign_event' },
        SIGNER_HEX,
        NOW
      )
    ).toBe(false)
  })

  it('is not claimed once expired or already claimed', () => {
    const { session } = offer()
    const secret = session.secret ?? ''

    expect(
      claimsBunkerOffer(
        session,
        connect(secret),
        SIGNER_HEX,
        NOW + NOSTR_NIP46_OFFER_TTL_MS
      )
    ).toBe(false)
    expect(
      claimsBunkerOffer(
        { ...session, clientPubkey: 'd'.repeat(64) },
        connect(secret),
        SIGNER_HEX,
        NOW
      )
    ).toBe(false)
  })

  it('compares secrets in full', () => {
    expect(secretsMatch('abc', 'abc')).toBe(true)
    expect(secretsMatch('abd', 'abc')).toBe(false)
    expect(secretsMatch('ab', 'abc')).toBe(false)
    expect(secretsMatch('', '')).toBe(false)
  })
})
