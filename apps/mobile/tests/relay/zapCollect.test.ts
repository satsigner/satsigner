import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools'

import { clearNdkRegistry } from '@/api/ndkRegistry'
import { resetRelayHealth } from '@/api/nostrRelayHealth'
import { NOSTR_ZAP_COLLECT_TIMEOUT_MS } from '@/constants/nostr'
import { fetchZapsByPubkey, fetchZapsSentByPubkey } from '@/utils/nostrZap'

import { BASE_CREATED_AT, fixturePubkey } from './support/fixtures'
import { startTestRelay, type TestRelay } from './support/testRelay'

const ANSWERED_WELL_BEFORE_TIMEOUT_MS = NOSTR_ZAP_COLLECT_TIMEOUT_MS / 3
const PROFILE_PUBKEY = fixturePubkey(42)
const ZAP_REQUEST_KIND = 9734
const ZAP_RECEIPT_KIND = 9735
const ZAP_AMOUNT_MSATS = '21000'
const SLOW_EOSE_MS = 300
const UNREACHABLE_RELAY_URL = 'ws://127.0.0.1:1'

function signedZapReceipt(
  zapperKey: Uint8Array,
  lnurlServerKey: Uint8Array,
  claimedZapper = getPublicKey(zapperKey)
) {
  const recipient = fixturePubkey(7)
  const signedRequest = finalizeEvent(
    {
      content: 'thanks',
      created_at: BASE_CREATED_AT,
      kind: ZAP_REQUEST_KIND,
      tags: [
        ['p', recipient],
        ['amount', ZAP_AMOUNT_MSATS]
      ]
    },
    zapperKey
  )
  const zapRequest = { ...signedRequest, pubkey: claimedZapper }
  return finalizeEvent(
    {
      content: '',
      created_at: BASE_CREATED_AT + 1,
      kind: ZAP_RECEIPT_KIND,
      tags: [
        ['p', recipient],
        ['P', claimedZapper],
        ['description', JSON.stringify(zapRequest)]
      ]
    },
    lnurlServerKey
  )
}

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

describe('outgoing zap receipts', () => {
  const relays: TestRelay[] = []

  afterEach(async () => {
    clearNdkRegistry()
    await Promise.all(relays.splice(0).map((relay) => relay.stop()))
  })

  it('finds receipts signed by the LNURL server through the zapper P tag', async () => {
    const zapperKey = generateSecretKey()
    const relay = await startTestRelay()
    relays.push(relay)
    relay.seed([signedZapReceipt(zapperKey, generateSecretKey())])

    const sent = await fetchZapsSentByPubkey(getPublicKey(zapperKey), [
      relay.url
    ])

    expect(sent).toHaveLength(1)
    expect(sent[0]?.direction).toBe('outgoing')
  })

  it('ignores receipts whose zap request was not signed by the zapper', async () => {
    const victim = getPublicKey(generateSecretKey())
    const relay = await startTestRelay()
    relays.push(relay)
    relay.seed([
      signedZapReceipt(generateSecretKey(), generateSecretKey(), victim)
    ])

    await expect(
      fetchZapsSentByPubkey(victim, [relay.url])
    ).resolves.toStrictEqual([])
  })
})
