import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha2'
import { hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk'
import {
  type NostrEvent,
  finalizeEvent,
  getEventHash,
  getPublicKey,
  nip44,
  nip59
} from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import { z } from 'zod'

import {
  NOSTR_GIFT_WRAP_KEY_SALT,
  NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { mineEventWithinDeadline } from '@/utils/nostrPow'

const SECRET_KEY_BYTES = 32

type NostrRumor = ReturnType<typeof nip59.createRumor>

const StoredRumorSchema = z.object({
  content: z.string(),
  created_at: z.number(),
  id: z.string(),
  kind: z.number(),
  pubkey: z.string(),
  tags: z.array(z.array(z.string()))
})

type GiftWrapOptions = {
  powBits?: number
}

type CreateRumorParams = {
  content: string
  kind: number
  senderSecretKey: Uint8Array
  tags: string[][]
}

/**
 * The wrap key is derived from the sender key, the rumor and the recipient
 * instead of being random, so the sender can later sign a NIP-09 deletion
 * for the wrap without storing any extra secret. HKDF output is
 * pseudorandom, so wraps stay unlinkable to the sender.
 */
function deriveWrapSecretKey(
  senderSecretKey: Uint8Array,
  rumorId: string,
  recipientPubkey: string
): Uint8Array {
  return hkdf(
    sha256,
    senderSecretKey,
    utf8ToBytes(NOSTR_GIFT_WRAP_KEY_SALT),
    Uint8Array.from([...hexToBytes(rumorId), ...hexToBytes(recipientPubkey)]),
    SECRET_KEY_BYTES
  )
}

function createChatRumor({
  content,
  kind,
  senderSecretKey,
  tags
}: CreateRumorParams): NostrRumor {
  return nip59.createRumor({ content, kind, tags }, senderSecretKey)
}

function randomPastTimestamp(): number {
  const now = Math.round(Date.now() / MS_PER_SECOND)
  return Math.round(now - Math.random() * NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC)
}

/**
 * NIP-59 wrap of an existing rumor for one recipient, signed by the derived
 * wrap key and optionally mined (NIP-13) so recipients can filter spam
 * before decrypting.
 */
async function createDerivedGiftWrap(
  rumor: NostrRumor,
  senderSecretKey: Uint8Array,
  recipientPubkey: string,
  { powBits = 0 }: GiftWrapOptions = {}
): Promise<NostrEvent> {
  const seal = nip59.createSeal(rumor, senderSecretKey, recipientPubkey)
  const wrapSecretKey = deriveWrapSecretKey(
    senderSecretKey,
    rumor.id,
    recipientPubkey
  )
  const content = nip44.v2.encrypt(
    JSON.stringify(seal),
    nip44.getConversationKey(wrapSecretKey, recipientPubkey)
  )
  const event = await mineEventWithinDeadline(
    {
      content,
      created_at: randomPastTimestamp(),
      kind: nostrKinds.GiftWrap,
      pubkey: getPublicKey(wrapSecretKey),
      tags: [['p', recipientPubkey]]
    },
    powBits,
    { fixedCreatedAt: true }
  )
  return finalizeEvent(event, wrapSecretKey)
}

/** NIP-09 request, signed by the wrap's own key, to drop wraps we sent. */
function createDerivedWrapDeletion(
  senderSecretKey: Uint8Array,
  rumorId: string,
  recipientPubkey: string,
  wrapIds: string[]
): NostrEvent {
  return finalizeEvent(
    {
      content: '',
      created_at: Math.round(Date.now() / MS_PER_SECOND),
      kind: nostrKinds.EventDeletion,
      tags: [
        ...wrapIds.map((wrapId) => ['e', wrapId]),
        ['k', String(nostrKinds.GiftWrap)]
      ]
    },
    deriveWrapSecretKey(senderSecretKey, rumorId, recipientPubkey)
  )
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** A rumor we stored as JSON, only when its id still matches its content. */
function parseStoredRumor(json: string): NostrRumor | null {
  const parsed = StoredRumorSchema.safeParse(parseJson(json))
  if (!parsed.success) {
    return null
  }
  const { id, ...unsigned } = parsed.data
  return getEventHash(unsigned) === id ? parsed.data : null
}

function toNdkEvent(event: NostrEvent): NDKEvent {
  return new NDKEvent(
    new NDK({ autoConnectUserRelays: false, enableOutboxModel: false }),
    event
  )
}

export {
  createChatRumor,
  createDerivedGiftWrap,
  createDerivedWrapDeletion,
  deriveWrapSecretKey,
  parseStoredRumor,
  toNdkEvent
}
export type { NostrRumor }
