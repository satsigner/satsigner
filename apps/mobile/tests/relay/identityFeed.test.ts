import { finalizeEvent } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'

import { clearNdkRegistry } from '@/api/ndkRegistry'
import { NostrAPI } from '@/api/nostr'
import {
  fetchProfilesCoalesced,
  resetProfileFetcher
} from '@/api/nostrProfileFetcher'
import { resetRelayHealth } from '@/api/nostrRelayHealth'
import { fetchZapsByPubkey } from '@/utils/nostrZap'

import { createTestIdentity, type TestIdentity } from './support/identities'
import { resetNodeNitroSqlite } from './support/nodeNitroSqlite'
import { startTestRelay, type TestRelay } from './support/testRelay'

const NOW_SEC = Math.floor(Date.now() / 1000)
const NOTE_COUNT = 5
const PROFILE_COUNT = 40
const MAX_PROFILE_REQS = 3
const CONNECT_TIMEOUT_MS = 2000
const ZAP_AMOUNT_MSATS = '21000'

function signedNote(author: TestIdentity, index: number) {
  return finalizeEvent(
    {
      content: `note ${index}`,
      created_at: NOW_SEC - 100 + index,
      kind: nostrKinds.ShortTextNote,
      tags: []
    },
    author.secretKey
  )
}

function signedProfile(author: TestIdentity, name: string, createdAt: number) {
  return finalizeEvent(
    {
      content: JSON.stringify({ display_name: name, name }),
      created_at: createdAt,
      kind: nostrKinds.Metadata,
      tags: []
    },
    author.secretKey
  )
}

// Zap receipts are signed by the LNURL server, not the zapped user; the
// zapped pubkey is only in the `p` tag.
function signedZapReceipt(
  server: TestIdentity,
  zapped: string,
  createdAt: number
) {
  return finalizeEvent(
    {
      content: '',
      created_at: createdAt,
      kind: nostrKinds.Zap,
      tags: [
        ['p', zapped],
        [
          'description',
          JSON.stringify({
            content: '',
            kind: nostrKinds.ZapRequest,
            pubkey: server.pubkey,
            tags: [
              ['p', zapped],
              ['amount', ZAP_AMOUNT_MSATS]
            ]
          })
        ]
      ]
    },
    server.secretKey
  )
}

function profileReqCount(relay: TestRelay): number {
  return relay
    .reqLog()
    .filter((entry) =>
      entry.filters.some((filter) =>
        filter.kinds?.includes(nostrKinds.Metadata)
      )
    ).length
}

describe('identity feed against a real relay', () => {
  const state: { relay?: TestRelay } = {}

  function relay(): TestRelay {
    if (!state.relay) {
      throw new Error('relay not started')
    }
    return state.relay
  }

  beforeEach(async () => {
    resetNodeNitroSqlite()
    resetRelayHealth()
    resetProfileFetcher()
    state.relay = await startTestRelay()
  })

  afterEach(async () => {
    clearNdkRegistry()
    await state.relay?.stop()
  })

  it('labels notes from relays as relay, then falls back to the cache', async () => {
    const author = createTestIdentity()
    relay().seed(
      Array.from({ length: NOTE_COUNT }, (_, index) =>
        signedNote(author, index)
      )
    )
    const api = new NostrAPI([relay().url])

    const live = await api.fetchNotes(author.npub)
    expect(live.source).toBe('relay')
    expect(live.data).toHaveLength(NOTE_COUNT)

    relay().setFault({ type: 'refuse' })
    relay().disconnectAll()
    clearNdkRegistry()
    const offline = await new NostrAPI([relay().url]).fetchNotes(author.npub)

    expect(offline.source).toBe('cache')
    expect(offline.error).toBe('noRelays')
    expect(offline.data.map((note) => note.id)).toStrictEqual(
      live.data.map((note) => note.id)
    )
  }, 30_000)

  it('reports a timeout instead of an empty feed when the relay never answers', async () => {
    relay().setFault({ type: 'neverEose' })
    const author = createTestIdentity()

    const result = await new NostrAPI([relay().url]).fetchNotes(author.npub)

    expect(result.source).toBe('cache')
    expect(result.error).toBe('timeout')
  }, 30_000)

  it('batches many concurrent profile requests into a few REQs', async () => {
    const authors = Array.from({ length: PROFILE_COUNT }, () =>
      createTestIdentity()
    )
    relay().seed(
      authors.map((author, index) =>
        signedProfile(author, `user ${index}`, NOW_SEC)
      )
    )

    const batches = await Promise.all(
      authors.map((author) =>
        fetchProfilesCoalesced([author.pubkey], [relay().url])
      )
    )

    expect(batches.every((batch) => batch.size === 1)).toBe(true)
    expect(profileReqCount(relay())).toBeLessThanOrEqual(MAX_PROFILE_REQS)
  }, 30_000)

  it('never lets an older kind 0 replace a newer one', async () => {
    const author = createTestIdentity()
    relay().seed([signedProfile(author, 'newest', NOW_SEC)])
    await fetchProfilesCoalesced([author.pubkey], [relay().url])

    const older = await startTestRelay()
    older.seed([signedProfile(author, 'stale', NOW_SEC - 1000)])
    resetProfileFetcher()
    const batch = await fetchProfilesCoalesced([author.pubkey], [older.url])
    await older.stop()

    expect(batch.get(author.pubkey)?.displayName).toBe('newest')
  }, 30_000)

  it('keeps a separate zap cursor per pubkey', async () => {
    const server = createTestIdentity()
    const alice = createTestIdentity()
    const bob = createTestIdentity()
    relay().seed([
      signedZapReceipt(server, alice.pubkey, NOW_SEC - 10),
      signedZapReceipt(server, bob.pubkey, NOW_SEC - 500)
    ])

    const aliceZaps = await fetchZapsByPubkey(alice.pubkey, [relay().url])
    const bobZaps = await fetchZapsByPubkey(bob.pubkey, [relay().url])

    expect(aliceZaps.data).toHaveLength(1)
    expect(bobZaps.source).toBe('relay')
    expect(bobZaps.data).toHaveLength(1)
  }, 30_000)

  it('fails fast with noRelays when nothing is configured', async () => {
    const api = new NostrAPI([])

    await expect(api.connect(CONNECT_TIMEOUT_MS)).rejects.toThrow(
      'No relays configured'
    )
  })
})
