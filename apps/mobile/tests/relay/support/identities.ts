import {
  type Event,
  generateSecretKey,
  getPublicKey,
  nip19,
  nip59
} from 'nostr-tools'

import { compressMessage } from '@/utils/nostr'

const NIP17_CHAT_KIND = 14

type TestIdentity = {
  secretKey: Uint8Array
  pubkey: string
  nsec: string
  npub: string
}

function createTestIdentity(): TestIdentity {
  const secretKey = generateSecretKey()
  const pubkey = getPublicKey(secretKey)
  return {
    npub: nip19.npubEncode(pubkey),
    nsec: nip19.nsecEncode(secretKey),
    pubkey,
    secretKey
  }
}

/**
 * A device-sync DM exactly as useNostrPublish sends it: a compressed
 * `{created_at, description}` payload in a NIP-59 gift wrap, with the rumor
 * timestamp under test control.
 */
function wrapDeviceDm(
  sender: TestIdentity,
  recipient: TestIdentity,
  createdAt: number,
  description: string
): Event {
  return nip59.wrapEvent(
    {
      content: compressMessage({ created_at: createdAt, description }),
      created_at: createdAt,
      kind: NIP17_CHAT_KIND,
      tags: [['p', recipient.pubkey]]
    },
    sender.secretKey,
    recipient.pubkey
  )
}

/** A NIP-17 kind 14 chat message from sender to recipient. */
function wrapChatMessage(
  sender: TestIdentity,
  recipient: TestIdentity,
  createdAt: number,
  text: string
): Event {
  return nip59.wrapEvent(
    {
      content: text,
      created_at: createdAt,
      kind: NIP17_CHAT_KIND,
      tags: [['p', recipient.pubkey]]
    },
    sender.secretKey,
    recipient.pubkey
  )
}

function rumorIdOfWrap(wrap: Event, recipient: TestIdentity): string {
  return nip59.unwrapEvent(wrap, recipient.secretKey).id
}

export { createTestIdentity, rumorIdOfWrap, wrapChatMessage, wrapDeviceDm }
export type { TestIdentity }
