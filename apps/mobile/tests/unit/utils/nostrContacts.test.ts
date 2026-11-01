import { setNostrFollowCache } from '@/storage/mmkv'
import { type NostrKind0Profile } from '@/types/models/Nostr'
import {
  contactToIdentity,
  fetchNostrContacts,
  filterNostrContacts,
  getNostrContactsPlaceholder,
  mergeProfileBatch
} from '@/utils/nostrContacts'

jest.mock<typeof import('nostr-tools')>('nostr-tools', () => ({
  nip19: {
    npubEncode: (hex: string) => `npub1mock${hex.slice(0, 8)}`
  }
}))

const mockProfileBatchListeners: ((
  batch: Map<string, NostrKind0Profile>
) => void)[] = []

jest.mock<typeof import('@/api/nostr')>('@/api/nostr', () => ({
  NostrAPI: jest.fn(() => ({
    disconnect: jest.fn(),
    fetchKind3FollowingPubkeys: () =>
      Promise.resolve({
        data: {
          connectedRelayCount: 1,
          kind3Found: true,
          pubkeys: ['c'.repeat(64)],
          relaysQueried: ['wss://relay.test']
        },
        source: 'relay'
      }),
    streamKind0Profiles: (
      _pubkeys: string[],
      onBatch: (batch: Map<string, NostrKind0Profile>) => void
    ) => {
      mockProfileBatchListeners.push(onBatch)
      return Promise.resolve()
    }
  }))
}))

describe('contactToIdentity', () => {
  it('maps contact profile fields to NostrIdentity', () => {
    const hex = 'a'.repeat(64)
    const identity = contactToIdentity({
      profile: {
        displayName: 'Alice',
        lud16: 'alice@wallet.com',
        nip05: 'alice@example.com',
        picture: 'https://example.com/alice.jpg'
      },
      pubkey: hex
    })

    expect(identity.displayName).toBe('Alice')
    expect(identity.lud16).toBe('alice@wallet.com')
    expect(identity.nip05).toBe('alice@example.com')
    expect(identity.picture).toBe('https://example.com/alice.jpg')
    expect(identity.isWatchOnly).toBe(false)
    expect(identity.npub).toBe(`npub1mock${hex.slice(0, 8)}`)
  })

  it('handles missing profile', () => {
    const hex = 'b'.repeat(64)
    const identity = contactToIdentity({ profile: null, pubkey: hex })

    expect(identity.displayName).toBeUndefined()
    expect(identity.npub).toBe(`npub1mock${hex.slice(0, 8)}`)
  })
})

describe('mergeProfileBatch', () => {
  it('merges profile data for matching pubkeys only', () => {
    const pk1 = 'a'.repeat(64)
    const pk2 = 'b'.repeat(64)
    const contacts = [
      { profile: null, pubkey: pk1 },
      { profile: null, pubkey: pk2 }
    ]
    const batch = new Map([
      [pk1, { displayName: 'Alice', nip05: 'alice@example.com' }]
    ])

    const merged = mergeProfileBatch(contacts, batch)

    expect(merged[0].profile?.displayName).toBe('Alice')
    expect(merged[1].profile).toBeNull()
  })
})

describe('getNostrContactsPlaceholder', () => {
  it('shows cached follows without claiming a kind 3 was found', () => {
    const npub = 'npub1placeholder'
    setNostrFollowCache(npub, ['a'.repeat(64)])

    const placeholder = getNostrContactsPlaceholder(npub)

    expect(placeholder?.kind3Found).toBe(false)
    expect(placeholder?.source).toBe('cache')
    expect(placeholder?.contacts.map((c) => c.pubkey)).toStrictEqual([
      'a'.repeat(64)
    ])
  })

  it('is undefined without cached follows', () => {
    expect(getNostrContactsPlaceholder('npub1none')).toBeUndefined()
  })
})

describe('filterNostrContacts', () => {
  it('matches display name, nip05 or npub, ignoring case', () => {
    const contacts = [
      { profile: { displayName: 'Alice' }, pubkey: 'a'.repeat(64) },
      { profile: { nip05: 'bob@example.com' }, pubkey: 'b'.repeat(64) }
    ]
    expect(filterNostrContacts(contacts, ' ALI ')).toHaveLength(1)
    expect(filterNostrContacts(contacts, 'example')).toHaveLength(1)
    expect(filterNostrContacts(contacts, '')).toBe(contacts)
  })
})

describe('fetchNostrContacts', () => {
  it('leaves the resolved contacts untouched when profiles arrive later', async () => {
    const pubkey = 'c'.repeat(64)
    const batches: ReturnType<typeof mergeProfileBatch>[] = []

    const result = await fetchNostrContacts('npub1late', ['wss://relay.test'], {
      onProfileBatch: (contacts) => batches.push(contacts)
    })
    const resolvedContacts = result.contacts
    for (const listener of mockProfileBatchListeners) {
      listener(new Map([[pubkey, { displayName: 'Carol' }]]))
    }

    expect(resolvedContacts[0].profile).toBeNull()
    expect(batches.at(-1)?.[0].profile?.displayName).toBe('Carol')
    expect(batches.at(-1)).not.toBe(resolvedContacts)
  })
})
