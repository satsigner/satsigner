/**
 * Live NIP-17 gift-wrap roundtrip against real public relays — no app, no
 * emulator. Proves the security-report transport contract end to end:
 * publish (relay ACK) -> retrieval by #p tag -> NIP-59 unwrap -> exact
 * content and sender.
 *
 * Relays are shared infrastructure, so the test soft-passes when every relay
 * is unreachable (offline CI runner); once at least one relay ACKs the
 * publish, the full roundtrip is hard-asserted.
 *
 * Run:
 *   cd apps/mobile && npx jest tests/int/api/nip17-roundtrip.test.ts
 */
// Use the real nostr-tools: the shared manual mock
// (tests/__mocks__/nostr-tools.js) stubs exactly the behaviour under test.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

import {
  generateSecretKey,
  getPublicKey,
  nip17,
  nip59,
  SimplePool
} from 'nostr-tools'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://nostr.band']
const PUBLISH_WAIT_MS = 3_000
const RETRIEVE_ATTEMPTS = 3
const RETRIEVE_DELAY_MS = 2_000

jest.setTimeout(90_000)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

describe('nip-17 live relay roundtrip', () => {
  it('publishes, retrieves, and unwraps a gift wrap to self', async () => {
    const pool = new SimplePool()
    const secretKey = generateSecretKey()
    const publicKey = getPublicKey(secretKey)
    const probe = `satsigner int test ${Date.now()} 🔐`
    const wrap = nip17.wrapEvent(secretKey, { publicKey }, probe)

    let published = false
    try {
      try {
        await Promise.any(
          pool.publish(RELAYS, wrap).map((p) => p.then(() => undefined))
        )
        published = true
      } catch {
        // eslint-disable-next-line no-console
        console.warn(`all relays unreachable (${RELAYS.join(', ')}) — skipping`)
      }

      if (!published) {
        return
      }

      // Give the ACKing relays a moment to index before querying.
      await sleep(PUBLISH_WAIT_MS)

      let retrieved = null
      for (
        let attempt = 0;
        attempt < RETRIEVE_ATTEMPTS && retrieved === null;
        attempt += 1
      ) {
        retrieved = await pool.get(RELAYS, {
          '#p': [publicKey],
          kinds: [1059]
        })
        if (retrieved === null) {
          await sleep(RETRIEVE_DELAY_MS)
        }
      }

      expect(retrieved).not.toBeNull()
      expect(retrieved!.kind).toBe(1059)

      const rumor = nip59.unwrapEvent(retrieved!, secretKey) as {
        content?: string
        kind?: number
        pubkey?: string
      }
      expect(rumor.kind).toBe(14)
      expect(rumor.pubkey).toBe(publicKey)
      expect(rumor.content).toBe(probe)
    } finally {
      pool.close(RELAYS)
      pool.destroy()
    }
  })
})
