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
})
