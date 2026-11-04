import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19
} from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'

import { clearNdkRegistry } from '@/api/ndkRegistry'
import { NostrAPI } from '@/api/nostr'
import { resetRelayHealth } from '@/api/nostrRelayHealth'

import { BASE_CREATED_AT } from './support/fixtures'
import { startTestRelay, type TestRelay } from './support/testRelay'

const FORGED_LATER_BY_SEC = 100
const NEWER_BY_SEC = 10

function signedProfile(
  secretKey: Uint8Array,
  content: string,
  createdAt = BASE_CREATED_AT
) {
  return finalizeEvent(
    { content, created_at: createdAt, kind: nostrKinds.Metadata, tags: [] },
    secretKey
  )
}

function newestProfileContent(relay: TestRelay, pubkey: string) {
  const [newest] = relay
    .events()
    .filter(
      (event) => event.kind === nostrKinds.Metadata && event.pubkey === pubkey
    )
    .toSorted((a, b) => b.created_at - a.created_at)
  return newest ? JSON.parse(newest.content) : null
}

describe('publishing a Nostr profile', () => {
  const relays: TestRelay[] = []

  beforeEach(() => {
    resetRelayHealth()
  })

  afterEach(async () => {
    clearNdkRegistry()
    await Promise.all(relays.splice(0).map((relay) => relay.stop()))
  })

  it('writes the changes over the signed relay copy and ignores a forged one', async () => {
    const secretKey = generateSecretKey()
    const pubkey = getPublicKey(secretKey)
    const relay = await startTestRelay()
    relays.push(relay)
    const published = finalizeEvent(
      {
        content: JSON.stringify({ about: 'bitcoiner', name: 'satoshi' }),
        created_at: BASE_CREATED_AT,
        kind: nostrKinds.Metadata,
        tags: []
      },
      secretKey
    )
    const forged = {
      ...published,
      content: JSON.stringify({ lud16: 'attacker@evil.example' }),
      created_at: BASE_CREATED_AT + FORGED_LATER_BY_SEC
    }
    relay.seed([published, forged])

    await new NostrAPI([relay.url]).publishProfile(
      nip19.nsecEncode(secretKey),
      { nip05: 'satoshi@example.com' },
      { displayName: 'satoshi' }
    )

    expect(newestProfileContent(relay, pubkey)).toStrictEqual({
      about: 'bitcoiner',
      name: 'satoshi',
      nip05: 'satoshi@example.com'
    })
  })

  it('builds on the newest copy across relays', async () => {
    const secretKey = generateSecretKey()
    const pubkey = getPublicKey(secretKey)
    const [first, second, newest] = await Promise.all([
      startTestRelay(),
      startTestRelay(),
      startTestRelay()
    ])
    relays.push(first, second, newest)
    const oldCopy = signedProfile(secretKey, JSON.stringify({ name: 'old' }))
    first.seed([oldCopy])
    second.seed([oldCopy])
    newest.seed([
      signedProfile(
        secretKey,
        JSON.stringify({ about: 'edited elsewhere', name: 'new' }),
        BASE_CREATED_AT + NEWER_BY_SEC
      )
    ])

    await new NostrAPI(relays.map(({ url }) => url)).publishProfile(
      nip19.nsecEncode(secretKey),
      { nip05: 'satoshi@example.com' },
      {}
    )

    expect(newestProfileContent(first, pubkey)).toStrictEqual({
      about: 'edited elsewhere',
      name: 'new',
      nip05: 'satoshi@example.com'
    })
  })

  it('falls back to the local profile when the relay copy is not an object', async () => {
    const secretKey = generateSecretKey()
    const relay = await startTestRelay()
    relays.push(relay)
    relay.seed([signedProfile(secretKey, 'not json')])

    const published = await new NostrAPI([relay.url]).publishProfile(
      nip19.nsecEncode(secretKey),
      { nip05: 'satoshi@example.com' },
      { displayName: 'satoshi' }
    )

    expect(published).toMatchObject({
      displayName: 'satoshi',
      nip05: 'satoshi@example.com'
    })
  })
})
