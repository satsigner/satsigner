import { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import { generateSecretKey } from 'nostr-tools'

import { clearNdkRegistry, getOrCreateNdk } from '@/api/ndkRegistry'
import { NostrAPI, testNostrRelaysReachable } from '@/api/nostr'
import {
  getRelayHealthSnapshot,
  isRelayCoolingDown,
  resetRelayHealth
} from '@/api/nostrRelayHealth'
import { NostrNoRelaysError, NostrPublishError } from '@/utils/errors'

import { BASE_CREATED_AT } from './support/fixtures'
import { CONNECT_TIMEOUT_MS } from './support/testNdk'
import { startTestRelay, type TestRelay } from './support/testRelay'

const LIVE_EVENT_WAIT_MS = 2000
const TEXT_NOTE_KIND = 1

function waitFor(predicate: () => boolean, timeoutMs = LIVE_EVENT_WAIT_MS) {
  const startedAt = Date.now()
  return new Promise<void>((resolve, reject) => {
    function poll() {
      if (predicate()) {
        resolve()
        return
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('condition not met in time'))
        return
      }
      setTimeout(poll, 20)
    }
    poll()
  })
}

async function signedNote(secretKey: Uint8Array, content: string) {
  const signer = new NDKPrivateKeySigner(secretKey)
  const event = new NDKEvent(undefined, {
    content,
    created_at: BASE_CREATED_AT,
    kind: TEXT_NOTE_KIND,
    tags: []
  })
  await event.sign(signer)
  return event
}

describe('relay health against real sockets', () => {
  const relays: TestRelay[] = []

  async function startRelays(count: number) {
    const started = await Promise.all(
      Array.from({ length: count }, () => startTestRelay())
    )
    relays.push(...started)
    return started
  }

  beforeEach(() => {
    resetRelayHealth()
  })

  afterEach(async () => {
    clearNdkRegistry()
    await Promise.all(relays.splice(0).map((relay) => relay.stop()))
  })

  it('throws NostrNoRelaysError when every relay refuses', async () => {
    const [relay] = await startRelays(1)
    relay?.setFault({ type: 'refuse' })
    const api = new NostrAPI([relay?.url ?? ''])

    await expect(api.connect(CONNECT_TIMEOUT_MS)).rejects.toBeInstanceOf(
      NostrNoRelaysError
    )
  })

  it('throws immediately when no relays are configured', async () => {
    const api = new NostrAPI([])

    await expect(api.connect(CONNECT_TIMEOUT_MS)).rejects.toBeInstanceOf(
      NostrNoRelaysError
    )
  })

  it('connects as soon as one of three relays is up', async () => {
    const [up, downA, downB] = await startRelays(3)
    downA?.setFault({ type: 'refuse' })
    downB?.setFault({ type: 'refuse' })
    const urls = [up, downA, downB].map((relay) => relay?.url ?? '')
    const api = new NostrAPI(urls)

    await expect(api.connect(CONNECT_TIMEOUT_MS)).resolves.toBe(true)
    expect(api.getConnectedRelayUrls()).toHaveLength(1)

    await waitFor(() => isRelayCoolingDown(downA?.url ?? ''))
    const [upHealth] = getRelayHealthSnapshot([up?.url ?? ''])
    expect(upHealth?.status).toBe('connected')
  })

  it('reports every relay that rejected a publish', async () => {
    const [relayA, relayB] = await startRelays(2)
    relayA?.setFault({ reason: 'blocked: spam', type: 'rejectPublish' })
    relayB?.setFault({ reason: 'rate-limited', type: 'rejectPublish' })
    const api = new NostrAPI([relayA?.url ?? '', relayB?.url ?? ''])
    await api.connect(CONNECT_TIMEOUT_MS)
    const note = await signedNote(generateSecretKey(), 'hello')

    const error = await api.publishEvent(note).catch((error) => error)

    expect(error).toBeInstanceOf(NostrPublishError)
    expect(
      error instanceof NostrPublishError ? error.failed.length : 0
    ).toBeGreaterThan(0)
  })

  it('probing reachability keeps live subscriptions on the shared pool working', async () => {
    const [relay] = await startRelays(1)
    const url = relay?.url ?? ''
    const ndk = getOrCreateNdk([url])
    await ndk.connect(CONNECT_TIMEOUT_MS)
    const received: string[] = []
    const sub = ndk.subscribe(
      { kinds: [TEXT_NOTE_KIND] },
      { closeOnEose: false }
    )
    sub.on('event', (event) => received.push(event.content))

    await testNostrRelaysReachable([url])
    const note = await signedNote(generateSecretKey(), 'still live')
    relay?.inject(note.rawEvent())

    await expect(
      waitFor(() => received.includes('still live'))
    ).resolves.toBeUndefined()
    sub.stop()
  })

  it('accepts a publish when at least one relay takes it', async () => {
    const [good, bad] = await startRelays(2)
    bad?.setFault({ reason: 'blocked', type: 'rejectPublish' })
    const api = new NostrAPI([good?.url ?? '', bad?.url ?? ''])
    await api.connect(CONNECT_TIMEOUT_MS)
    const note = await signedNote(generateSecretKey(), 'partial')

    await expect(api.publishEvent(note)).resolves.toBeUndefined()
    expect(good?.events().map((event) => event.content)).toContain('partial')
  })
})
