/**
 * Live NIP-17 gift-wrap roundtrip against real public relays — no app, no
 * emulator. Proves the security-report transport contract end to end:
 * publish (relay ACK) -> retrieval by id -> NIP-59 unwrap -> exact content
 * and sender.
 *
 * Relays are shared infrastructure, so the test soft-passes when every relay
 * is unreachable (offline CI runner); once at least one relay ACKs the
 * publish, the full roundtrip is hard-asserted against those ACKing relays.
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
  SimplePool,
  type Event
} from 'nostr-tools'

const RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://offchain.pub',
  'wss://relay.primal.net'
]
const CONNECTION_FAILURE_PREFIX = 'connection failure'
const POOL_CLOSE_SETTLE_MS = 200
const RETRIEVE_TIMEOUT_MS = 15_000

jest.setTimeout(90_000)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isConnectionFailure(reason: unknown): boolean {
  return (
    typeof reason === 'string' && reason.startsWith(CONNECTION_FAILURE_PREFIX)
  )
}

async function publishAndCollectAcks(
  pool: SimplePool,
  event: Event
): Promise<string[]> {
  const outcomes = await Promise.all(
    RELAYS.map(async (url) => {
      const [pending] = pool.publish([url], event)
      try {
        const reason = await pending
        if (isConnectionFailure(reason)) {
          return null
        }
        return url
      } catch {
        return null
      }
    })
  )
  return outcomes.filter((url) => url !== null)
}

function waitForEventById(
  pool: SimplePool,
  relays: string[],
  eventId: string,
  timeoutMs: number,
  abort: AbortSignal
): Promise<Event | null> {
  const { promise, resolve } = Promise.withResolvers<Event | null>()
  const state: { closer?: { close: () => void }; done: boolean } = {
    done: false
  }

  function finish(event: Event | null) {
    if (state.done) {
      return
    }
    state.done = true
    clearTimeout(timeout)
    state.closer?.close()
    resolve(event)
  }

  const timeout = setTimeout(() => {
    finish(null)
  }, timeoutMs)
  abort.addEventListener('abort', () => {
    finish(null)
  })
  state.closer = pool.subscribe(
    relays,
    { ids: [eventId] },
    {
      abort,
      onevent(event) {
        finish(event)
      }
    }
  )

  return promise
}

describe('nip-17 live relay roundtrip', () => {
  it('publishes, retrieves, and unwraps a gift wrap to self', async () => {
    const pool = new SimplePool({ enablePing: false })
    const secretKey = generateSecretKey()
    const publicKey = getPublicKey(secretKey)
    const probe = `satsigner int test ${Date.now()} 🔐`
    const wrap = nip17.wrapEvent(secretKey, { publicKey }, probe)

    const abort = new AbortController()

    try {
      const ackedRelays = await publishAndCollectAcks(pool, wrap)

      if (ackedRelays.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(`all relays unreachable (${RELAYS.join(', ')}) — skipping`)
        return
      }

      const retrieved = await waitForEventById(
        pool,
        ackedRelays,
        wrap.id,
        RETRIEVE_TIMEOUT_MS,
        abort.signal
      )

      expect(retrieved).not.toBeNull()
      expect(retrieved!.kind).toBe(1059)
      expect(retrieved!.id).toBe(wrap.id)

      const rumor = nip59.unwrapEvent(retrieved!, secretKey) as {
        content?: string
        kind?: number
        pubkey?: string
      }
      expect(rumor.kind).toBe(14)
      expect(rumor.pubkey).toBe(publicKey)
      expect(rumor.content).toBe(probe)
    } finally {
      abort.abort()
      // In-flight relay connects can register after abort; wait, then close.
      await sleep(POOL_CLOSE_SETTLE_MS)
      pool.close(RELAYS)
      pool.destroy()
    }
  })
})
