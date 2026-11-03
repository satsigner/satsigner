import { clearNdkRegistry } from '@/api/ndkRegistry'
import { resetRelayHealth } from '@/api/nostrRelayHealth'
import { NOSTR_ZAP_COLLECT_TIMEOUT_MS } from '@/constants/nostr'
import { fetchZapsByPubkey } from '@/utils/nostrZap'

import { fixturePubkey } from './support/fixtures'
import { startTestRelay, type TestRelay } from './support/testRelay'

const ANSWERED_WELL_BEFORE_TIMEOUT_MS = NOSTR_ZAP_COLLECT_TIMEOUT_MS / 3
const PROFILE_PUBKEY = fixturePubkey(42)
const SLOW_EOSE_MS = 300
const UNREACHABLE_RELAY_URL = 'ws://127.0.0.1:1'

describe('zap receipts against a relay that never sends EOSE', () => {
  const relays: TestRelay[] = []

  async function startRelays(count: number) {
    const started = await Promise.all(
      Array.from({ length: count }, () => startTestRelay())
    )
    relays.push(...started)
    return started
  }

  async function timedFetch(extraRelayUrls: string[] = []) {
    const startedAt = Date.now()
    const result = await fetchZapsByPubkey(PROFILE_PUBKEY, [
      ...relays.map(({ url }) => url),
      ...extraRelayUrls
    ])
    return { elapsedMs: Date.now() - startedAt, result }
  }

  beforeEach(() => {
    resetRelayHealth()
  })

  afterEach(async () => {
    clearNdkRegistry()
    await Promise.all(relays.splice(0).map((relay) => relay.stop()))
  })

  it('treats a relay that answers CLOSED as answered', async () => {
    const [, refusing] = await startRelays(2)
    refusing.setFault({ reason: 'kind not allowed', type: 'closed' })

    const { elapsedMs, result } = await timedFetch()

    expect(result.error).toBeUndefined()
    expect(result.source).toBe('relay')
    expect(elapsedMs).toBeLessThan(ANSWERED_WELL_BEFORE_TIMEOUT_MS)
  })

  it('finishes when CLOSED arrives before the other relay sends EOSE', async () => {
    const [healthy, refusing] = await startRelays(2)
    healthy.setFault({ ms: SLOW_EOSE_MS, type: 'delayEose' })
    refusing.setFault({ reason: 'kind not allowed', type: 'closed' })

    const { elapsedMs, result } = await timedFetch()

    expect(result.error).toBeUndefined()
    expect(elapsedMs).toBeLessThan(ANSWERED_WELL_BEFORE_TIMEOUT_MS)
  })

  it('reports an outage when every relay answers CLOSED', async () => {
    const started = await startRelays(2)
    for (const relay of started) {
      relay.setFault({ reason: 'rate-limited: slow down', type: 'closed' })
    }

    const { result } = await timedFetch()

    expect(result.error).toBeDefined()
    expect(result.source).toBe('cache')
  })

  it('does not wait for a relay that never connects', async () => {
    await startRelays(1)

    const { elapsedMs, result } = await timedFetch([UNREACHABLE_RELAY_URL])

    expect(result.error).toBeUndefined()
    expect(elapsedMs).toBeLessThan(ANSWERED_WELL_BEFORE_TIMEOUT_MS)
  })

  it('stops waiting for a silent relay once most relays sent EOSE', async () => {
    await startRelays(2)
    const [silent] = await startRelays(1)
    silent.setFault({ type: 'neverEose' })

    const { elapsedMs, result } = await timedFetch()

    expect(result.error).toBeUndefined()
    expect(result.source).toBe('relay')
    expect(elapsedMs).toBeLessThan(ANSWERED_WELL_BEFORE_TIMEOUT_MS)
  })
})
