import { getPublicKey, verifyEvent } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'

import { unwrapNip59EventOrNull } from '@/api/nostr'
import {
  createChatRumor,
  createDerivedGiftWrap,
  createDerivedWrapDeletion,
  deriveWrapSecretKey,
  parseStoredRumor
} from '@/api/nostrGiftWrap'
import { getCommittedPow } from '@/utils/nostrPow'

// The repo-wide manual mock stubs out the crypto this test exercises.
jest.unmock('nostr-tools')
jest.mock('@nostr-dev-kit/ndk')
jest.mock<typeof import('sonner-native')>('sonner-native', () => ({
  toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() }
}))

function secretKey(lastByte: number): Uint8Array {
  const key = new Uint8Array(32)
  key[31] = lastByte
  return key
}

const senderSecret = secretKey(1)
const recipientSecret = secretKey(2)
const otherRecipientSecret = secretKey(3)
const recipientPubkey = getPublicKey(recipientSecret)
const otherRecipientPubkey = getPublicKey(otherRecipientSecret)

const rumor = createChatRumor({
  content: 'hello',
  kind: nostrKinds.PrivateDirectMessage,
  senderSecretKey: senderSecret,
  tags: [['p', recipientPubkey]]
})

describe('deriveWrapSecretKey', () => {
  it('is deterministic for the same sender, rumor and recipient', () => {
    expect(
      deriveWrapSecretKey(senderSecret, rumor.id, recipientPubkey)
    ).toStrictEqual(
      deriveWrapSecretKey(senderSecret, rumor.id, recipientPubkey)
    )
  })

  it('differs per recipient, per rumor and per sender', () => {
    const base = deriveWrapSecretKey(senderSecret, rumor.id, recipientPubkey)
    const otherRumor = createChatRumor({
      content: 'other',
      kind: nostrKinds.PrivateDirectMessage,
      senderSecretKey: senderSecret,
      tags: []
    })

    expect(
      deriveWrapSecretKey(senderSecret, rumor.id, otherRecipientPubkey)
    ).not.toStrictEqual(base)
    expect(
      deriveWrapSecretKey(senderSecret, otherRumor.id, recipientPubkey)
    ).not.toStrictEqual(base)
    expect(
      deriveWrapSecretKey(secretKey(9), rumor.id, recipientPubkey)
    ).not.toStrictEqual(base)
  })

  it('never reuses the sender key', () => {
    const wrapKey = deriveWrapSecretKey(senderSecret, rumor.id, recipientPubkey)

    expect(getPublicKey(wrapKey)).not.toBe(getPublicKey(senderSecret))
  })
})

describe('createDerivedGiftWrap', () => {
  it('produces a valid wrap the recipient can open', async () => {
    const wrap = await createDerivedGiftWrap(
      rumor,
      senderSecret,
      recipientPubkey
    )

    expect(verifyEvent(wrap)).toBe(true)
    expect(wrap.kind).toBe(nostrKinds.GiftWrap)
    expect(wrap.tags).toStrictEqual([['p', recipientPubkey]])
    expect(unwrapNip59EventOrNull(wrap, recipientSecret)).toMatchObject({
      content: 'hello',
      id: rumor.id,
      pubkey: getPublicKey(senderSecret)
    })
  })

  it('is signed by the derived key and keeps a backdated timestamp', async () => {
    const wrap = await createDerivedGiftWrap(
      rumor,
      senderSecret,
      recipientPubkey
    )

    expect(wrap.pubkey).toBe(
      getPublicKey(deriveWrapSecretKey(senderSecret, rumor.id, recipientPubkey))
    )
    expect(wrap.created_at).toBeLessThanOrEqual(Math.round(Date.now() / 1000))
  })

  it('mines the requested proof of work into the wrap', async () => {
    const wrap = await createDerivedGiftWrap(
      rumor,
      senderSecret,
      recipientPubkey,
      { powBits: 8 }
    )

    expect(getCommittedPow(wrap)).toBeGreaterThanOrEqual(8)
    expect(unwrapNip59EventOrNull(wrap, recipientSecret)?.id).toBe(rumor.id)
  })
})

describe('createDerivedWrapDeletion', () => {
  it('is a NIP-09 request signed by the same key as the wrap', async () => {
    const wrap = await createDerivedGiftWrap(
      rumor,
      senderSecret,
      recipientPubkey
    )
    const deletion = createDerivedWrapDeletion(
      senderSecret,
      rumor.id,
      recipientPubkey,
      [wrap.id]
    )

    expect(verifyEvent(deletion)).toBe(true)
    expect(deletion.kind).toBe(nostrKinds.EventDeletion)
    expect(deletion.pubkey).toBe(wrap.pubkey)
    expect(deletion.tags).toStrictEqual([
      ['e', wrap.id],
      ['k', String(nostrKinds.GiftWrap)]
    ])
  })
})

describe('parseStoredRumor', () => {
  it('round-trips a stored rumor', () => {
    expect(parseStoredRumor(JSON.stringify(rumor))).toStrictEqual(rumor)
  })

  it('rejects a rumor whose id no longer matches its content', () => {
    expect(
      parseStoredRumor(JSON.stringify({ ...rumor, content: 'tampered' }))
    ).toBeNull()
  })

  it('rejects garbage', () => {
    expect(parseStoredRumor('')).toBeNull()
    expect(parseStoredRumor('{"id":1}')).toBeNull()
  })
})
