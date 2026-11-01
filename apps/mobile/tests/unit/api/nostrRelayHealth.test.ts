import { EventEmitter } from 'node:events'

import type NDK from '@nostr-dev-kit/ndk'

import {
  connectToFirstRelay,
  getRelayHealthSnapshot,
  isRelayCoolingDown,
  markRelayClosed,
  markRelayConnected,
  markRelayEose,
  markRelayFailed,
  normalizeRelayUrl,
  resetRelayHealth
} from '@/api/nostrRelayHealth'
import { NOSTR_RELAY_COOLDOWN_MS } from '@/constants/nostr'
import { NostrNoRelaysError } from '@/utils/errors'

const RELAY_A = 'wss://relay-a.example'
const RELAY_B = 'wss://relay-b.example'
const CONNECT_TIMEOUT_MS = 1000

type FakeRelay = { url: string }

function createFakeNdk(urls: string[]) {
  const pool = new EventEmitter()
  const relays = new Map<string, FakeRelay>(urls.map((url) => [url, { url }]))
  const connected = new Set<string>()
  const fake = {
    connect: jest.fn().mockResolvedValue(undefined),
    pool: Object.assign(pool, {
      connectedRelays: () => [...connected].map((url) => ({ url })),
      relays
    })
  }
  function connectRelay(url: string) {
    connected.add(url)
    pool.emit('relay:connect', { url })
  }
  // Test double: only the pool surface connectToFirstRelay touches.
  return { connectRelay, ndk: fake as unknown as NDK }
}

describe('nostrRelayHealth', () => {
  beforeEach(() => {
    resetRelayHealth()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('normalizes relay urls', () => {
    expect(normalizeRelayUrl(' WSS://Relay.Example/ ')).toBe(
      'wss://relay.example'
    )
  })

  it('puts a failed relay on cooldown until it expires', () => {
    const now = 1_000_000
    markRelayFailed(RELAY_A, now)

    expect(isRelayCoolingDown(RELAY_A, now + 1)).toBe(true)
    expect(isRelayCoolingDown(RELAY_A, now + NOSTR_RELAY_COOLDOWN_MS + 1)).toBe(
      false
    )
  })

  it('clears the cooldown on connect and on EOSE', () => {
    markRelayFailed(RELAY_A)
    markRelayConnected(RELAY_A)
    expect(isRelayCoolingDown(RELAY_A)).toBe(false)

    markRelayClosed(RELAY_B, 'auth-required')
    markRelayEose(RELAY_B)
    expect(isRelayCoolingDown(RELAY_B)).toBe(false)
  })

  it('records the CLOSED reason', () => {
    markRelayClosed(RELAY_A, 'rate-limited')
    const [health] = getRelayHealthSnapshot([RELAY_A])

    expect(health?.lastClosedReason).toBe('rate-limited')
  })

  it('resolves as soon as the first relay connects', async () => {
    const { connectRelay, ndk } = createFakeNdk([RELAY_A, RELAY_B])
    const pending = connectToFirstRelay(ndk, CONNECT_TIMEOUT_MS)
    connectRelay(RELAY_A)

    await expect(pending).resolves.toBeUndefined()
    const [health] = getRelayHealthSnapshot([RELAY_A])
    expect(health?.status).toBe('connected')
  })

  it('throws NostrNoRelaysError when no relay connects in time', async () => {
    const { ndk } = createFakeNdk([RELAY_A, RELAY_B])
    const pending = connectToFirstRelay(ndk, CONNECT_TIMEOUT_MS)
    jest.advanceTimersByTime(CONNECT_TIMEOUT_MS)

    await expect(pending).rejects.toBeInstanceOf(NostrNoRelaysError)
    expect(isRelayCoolingDown(RELAY_A)).toBe(true)
    expect(isRelayCoolingDown(RELAY_B)).toBe(true)
  })
})
