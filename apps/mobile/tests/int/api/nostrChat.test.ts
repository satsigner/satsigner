/**
 * End-to-end receive path for identity DMs against real public relays:
 * a second ephemeral key sends a NIP-17 chat rumor (kind 14) to the identity,
 * and the app's own subscription machinery (subscribeToIdentityChat on
 * NostrAPI) must ingest it into the chat store.
 *
 * Soft-passes when no relay is reachable (offline CI).
 *
 * Run:
 *   cd apps/mobile && npx jest tests/int/api/nostrChat.test.ts
 */
jest.mock('nostr-tools', () => jest.requireActual('nostr-tools'))
jest.mock('@nostr-dev-kit/ndk', () =>
  jest.requireActual('@nostr-dev-kit/ndk')
)

// In-memory chat message store (no SQLite in this environment).
jest.mock('@/db/mutations/nostrChat', () => {
  const store = new Map<string, unknown>()
  return {
    __store: store,
    insertChatMessage: jest.fn((message: { id: string }) => {
      if (store.has(message.id)) {
        return false
      }
      store.set(message.id, message)
      return true
    }),
    updateChatMessageStatus: jest.fn()
  }
})

import { getPublicKey, nip19 } from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import { __store as chatStore } from '@/db/mutations/nostrChat'
import { sendNip17Chat, subscribeToIdentityChat } from '@/utils/nostrChat'

const RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band']

jest.setTimeout(120_000)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function ephemeralIdentity() {
  const secretKey = globalThis.crypto.getRandomValues(new Uint8Array(32))
  const pubkey = getPublicKey(secretKey)
  return {
    npub: nip19.npubEncode(pubkey),
    nsec: nip19.nsecEncode(secretKey),
    pubkey
  }
}

describe('nostr chat receive path (live relays)', () => {
  it('ingests a kind-14 gift wrap sent to the identity', async () => {
    const receiver = ephemeralIdentity()
    const sender = ephemeralIdentity()
    const probe = `e2e chat probe ${Date.now()}`

    const api = new NostrAPI(RELAYS)
    try {
      // Open the receive pipeline first (mirrors the chat screen on focus).
      await subscribeToIdentityChat(api, {
        npub: receiver.npub,
        nsec: receiver.nsec
      })

      // A different key sends the DM; sending through the same NostrAPI
      // instance also covers the publish path.
      await sendNip17Chat(api, sender, receiver.npub, probe)

      // Give relays time to index + deliver the subscription event.
      const deadline = Date.now() + 30_000
      let incoming = null as null | Record<string, unknown>
      while (Date.now() < deadline) {
        incoming =
          ([...chatStore.values()] as Record<string, unknown>[]).find(
            (m) =>
              m.direction === 'in' &&
              m.content === probe &&
              m.peerPubkey === sender.pubkey
          ) ?? null
        if (incoming) {
          break
        }
        await sleep(1_000)
      }

      expect(incoming).not.toBeNull()
      expect(incoming).toMatchObject({
        content: probe,
        direction: 'in',
        peerPubkey: sender.pubkey,
        protocol: 'nip17'
      })
    } finally {
      api.closeAllSubscriptions()
    }
  })
})
