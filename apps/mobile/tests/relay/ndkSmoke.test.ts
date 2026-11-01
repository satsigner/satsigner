import { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import type NDKType from '@nostr-dev-kit/ndk'
import { finalizeEvent, generateSecretKey } from 'nostr-tools'

import { BASE_CREATED_AT } from './support/fixtures'
import { CONNECT_TIMEOUT_MS, createTestNdk } from './support/testNdk'
import { startTestRelay, type TestRelay } from './support/testRelay'

const TEXT_NOTE_KIND = 1
const SEEDED_NOTES = 3

function signedNote(secretKey: Uint8Array, offset: number) {
  return finalizeEvent(
    {
      content: `note ${offset}`,
      created_at: BASE_CREATED_AT + offset,
      kind: TEXT_NOTE_KIND,
      tags: []
    },
    secretKey
  )
}

async function connectedNdk(relay: TestRelay): Promise<NDKType> {
  const ndk = createTestNdk([relay.url])
  await ndk.connect(CONNECT_TIMEOUT_MS)
  return ndk
}

describe('ndk against the test relay', () => {
  const state: { relay?: TestRelay } = {}

  function relay() {
    if (!state.relay) {
      throw new Error('relay not started')
    }
    return state.relay
  }

  beforeEach(async () => {
    state.relay = await startTestRelay()
  })

  afterEach(async () => {
    await state.relay?.stop()
  })

  it('connects to the relay', async () => {
    const ndk = await connectedNdk(relay())

    expect(ndk.pool.connectedRelays().map(({ url }) => url)).toStrictEqual([
      `${relay().url}/`
    ])
    expect(relay().connectionCount()).toBe(1)
  })

  it('fetchEvents resolves on EOSE with the stored events', async () => {
    const secretKey = generateSecretKey()
    const notes = Array.from({ length: SEEDED_NOTES }, (_, index) =>
      signedNote(secretKey, index)
    )
    relay().seed(notes)
    const ndk = await connectedNdk(relay())

    const fetched = await ndk.fetchEvents({ kinds: [TEXT_NOTE_KIND] })

    expect([...fetched].map(({ id }) => id).toSorted()).toStrictEqual(
      notes.map(({ id }) => id).toSorted()
    )
  })

  it('publishes a signed event that the relay stores', async () => {
    const ndk = await connectedNdk(relay())
    ndk.signer = NDKPrivateKeySigner.generate()
    const event = new NDKEvent(ndk, {
      content: 'published',
      kind: TEXT_NOTE_KIND
    })

    const publishedTo = await event.publish()

    expect([...publishedTo].map(({ url }) => url)).toStrictEqual([
      `${relay().url}/`
    ])
    expect(
      relay()
        .events()
        .map(({ id }) => id)
    ).toStrictEqual([event.id])
  })

  it('receives live events on an open subscription after EOSE', async () => {
    const ndk = await connectedNdk(relay())
    const subscription = ndk.subscribe(
      { kinds: [TEXT_NOTE_KIND] },
      { closeOnEose: false }
    )
    await new Promise<void>((resolve) => {
      subscription.on('eose', () => resolve())
    })
    const received = new Promise<string>((resolve) => {
      subscription.on('event', (event) => resolve(event.id))
    })
    const live = signedNote(generateSecretKey(), 0)

    relay().inject(live)

    await expect(received).resolves.toBe(live.id)
    expect(relay().openSubscriptions()[0]?.subIds).toHaveLength(1)
    subscription.stop()
  })

  // Documents the reliability bug: connect(timeout) resolves even when no
  // relay accepted the connection, so callers must check the pool themselves.
  it('connect resolves with zero connected relays when the relay refuses', async () => {
    relay().setFault({ type: 'refuse' })
    const ndk = createTestNdk([relay().url])

    await ndk.connect(CONNECT_TIMEOUT_MS)

    expect(ndk.pool.connectedRelays()).toHaveLength(0)
    expect(relay().connectionCount()).toBe(0)
  })
})
