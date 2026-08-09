import { finalizeEvent, getPublicKey, nip44, nip59 } from 'nostr-tools'

import { unwrapNip59EventOrNull } from '@/api/nostr'

// The repo-wide manual mock at tests/__mocks__/nostr-tools.js stubs out the
// crypto this test exercises — use the real module.
jest.unmock('nostr-tools')
jest.mock('@nostr-dev-kit/ndk')
jest.mock<typeof import('sonner-native')>('sonner-native', () => ({
  toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() }
}))

// Deterministic secret keys for reproducible tests
let keyCounter = 0
function nextSecretKey(): Uint8Array {
  keyCounter += 1
  const key = new Uint8Array(32)
  key[31] = keyCounter
  return key
}

const recipientSecret = nextSecretKey()
const recipientPubkey = getPublicKey(recipientSecret)

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

// Build a NIP-17 gift wrap to the recipient, controlling the seal key
// independently of the rumor pubkey (as an attacker would).
function buildGiftWrap(rumor: object, sealKey: Uint8Array) {
  const seal = finalizeEvent(
    {
      content: nip44.v2.encrypt(
        JSON.stringify(rumor),
        nip44.getConversationKey(sealKey, recipientPubkey)
      ),
      created_at: nowSeconds(),
      kind: 13,
      tags: []
    },
    sealKey
  )

  const wrapKey = nextSecretKey()
  return finalizeEvent(
    {
      content: nip44.v2.encrypt(
        JSON.stringify(seal),
        nip44.getConversationKey(wrapKey, recipientPubkey)
      ),
      created_at: nowSeconds(),
      kind: 1059,
      tags: [['p', recipientPubkey]]
    },
    wrapKey
  )
}

describe('unwrapNip59EventOrNull (NIP-17 sender verification)', () => {
  it('unwraps a legitimate gift-wrapped rumor', () => {
    const senderSecret = nextSecretKey()
    const rumor = nip59.createRumor(
      { content: 'hello', created_at: nowSeconds(), kind: 14, tags: [] },
      senderSecret
    )
    const wrap = buildGiftWrap(rumor, senderSecret)

    const unwrapped = unwrapNip59EventOrNull(wrap, recipientSecret)

    expect(unwrapped).not.toBeNull()
    expect(unwrapped?.pubkey).toBe(getPublicKey(senderSecret))
    expect(unwrapped?.content).toBe('hello')
  })

  it('rejects a rumor whose pubkey does not match the seal signer', () => {
    // Attacker seals with their own key but forges the rumor author to look
    // like one of the victim's trusted devices.
    const attackerSecret = nextSecretKey()
    const victimDevicePubkey = getPublicKey(nextSecretKey())
    const forgedRumor = {
      content: '{"data_type":"PSBT","data":"..."}',
      created_at: nowSeconds(),
      id: 'a'.repeat(64),
      kind: 14,
      pubkey: victimDevicePubkey,
      tags: []
    }
    const wrap = buildGiftWrap(forgedRumor, attackerSecret)

    expect(unwrapNip59EventOrNull(wrap, recipientSecret)).toBeNull()
  })

  it('rejects a seal with an invalid signature', () => {
    const senderSecret = nextSecretKey()
    const rumor = nip59.createRumor(
      { content: 'hello', created_at: nowSeconds(), kind: 14, tags: [] },
      senderSecret
    )
    const wrap = buildGiftWrap(rumor, senderSecret)

    // Corrupt the seal's signature: decrypt the wrap, tamper, re-wrap.
    const seal = JSON.parse(
      nip44.v2.decrypt(
        wrap.content,
        nip44.getConversationKey(recipientSecret, wrap.pubkey)
      )
    )
    seal.sig = seal.sig.replace(/[0-9a-f]/, (c: string) =>
      c === '0' ? '1' : '0'
    )
    const wrapKey = nextSecretKey()
    const tamperedWrap = finalizeEvent(
      {
        content: nip44.v2.encrypt(
          JSON.stringify(seal),
          nip44.getConversationKey(wrapKey, recipientPubkey)
        ),
        created_at: nowSeconds(),
        kind: 1059,
        tags: [['p', recipientPubkey]]
      },
      wrapKey
    )

    expect(unwrapNip59EventOrNull(tamperedWrap, recipientSecret)).toBeNull()
  })

  it('rejects garbage that cannot be decrypted', () => {
    const wrapKey = nextSecretKey()
    const wrap = finalizeEvent(
      {
        content: 'not-nip44-ciphertext',
        created_at: nowSeconds(),
        kind: 1059,
        tags: [['p', recipientPubkey]]
      },
      wrapKey
    )

    expect(unwrapNip59EventOrNull(wrap, recipientSecret)).toBeNull()
  })
})
