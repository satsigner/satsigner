jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

import { nip19 } from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import { getDb } from '@/db/connection'
import { getNostrFollowCache, setNostrFollowCache } from '@/storage/mmkv'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { getNostrIdentityRelays } from '@/utils/nostrContacts'

describe('getNostrIdentityRelays', () => {
  it('prefers the identity relay list', () => {
    expect(
      getNostrIdentityRelays(['wss://identity.relay'], ['wss://store.relay'])
    ).toStrictEqual(['wss://identity.relay'])
  })

  it('falls back to the store list when identity has none', () => {
    expect(getNostrIdentityRelays([], ['wss://store.relay'])).toStrictEqual([
      'wss://store.relay'
    ])
    expect(
      getNostrIdentityRelays(undefined, ['wss://store.relay'])
    ).toStrictEqual(['wss://store.relay'])
  })

  it('falls back to indexing relays when both are empty', () => {
    expect(getNostrIdentityRelays(undefined, [])).toStrictEqual(
      NostrAPI.INDEXING_RELAYS
    )
  })
})

describe('nostrIdentity store', () => {
  beforeEach(() => {
    useNostrIdentityStore.setState({
      activeIdentityNpub: null,
      identities: [],
      relays: []
    })
  })

  it('addIdentity connects relays by default so profiles/DMs load', () => {
    useNostrIdentityStore.getState().addIdentity({
      createdAt: Date.now(),
      isWatchOnly: false,
      npub: 'npub1example'
    })
    expect(useNostrIdentityStore.getState().identities[0].relayConnected).toBe(
      true
    )
  })

  it('addIdentity preserves an explicit disconnect choice', () => {
    useNostrIdentityStore.getState().addIdentity({
      createdAt: Date.now(),
      isWatchOnly: true,
      npub: 'npub1watched',
      relayConnected: false
    })
    expect(useNostrIdentityStore.getState().identities[0].relayConnected).toBe(
      false
    )
  })

  it('removeIdentity clears that identity follow cache and cached rows', () => {
    const hex = 'a'.repeat(64)
    const npub = nip19.npubEncode(hex)
    const other = nip19.npubEncode('b'.repeat(64))
    setNostrFollowCache(npub, ['c'.repeat(64)])
    setNostrFollowCache(other, ['c'.repeat(64)])
    useNostrIdentityStore.getState().addIdentity({
      createdAt: Date.now(),
      isWatchOnly: true,
      npub
    })
    const execute = jest.mocked(getDb().execute)
    execute.mockClear()

    useNostrIdentityStore.getState().removeIdentity(npub)

    expect(getNostrFollowCache(npub)).toBeNull()
    expect(getNostrFollowCache(other)).toStrictEqual(['c'.repeat(64)])
    expect(execute).toHaveBeenCalledWith(
      'DELETE FROM nostr_event_cache WHERE pubkey = ? OR target_pubkey = ?',
      [hex, hex]
    )
  })
})
