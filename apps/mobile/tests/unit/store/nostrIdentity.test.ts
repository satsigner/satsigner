jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

import { nip19 } from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import { getDb } from '@/db/connection'
import { getNostrFollowCache, setNostrFollowCache } from '@/storage/mmkv'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { getNostrIdentityRelays } from '@/utils/nostrContacts'
import * as nostrSecrets from '@/utils/nostrSecrets'

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

  it('addIdentity leaves an existing identity and its stored secrets alone', () => {
    const { addIdentity } = useNostrIdentityStore.getState()
    addIdentity({
      createdAt: Date.now(),
      isWatchOnly: false,
      npub: 'npub1owned',
      nsec: 'nsec1owned'
    })
    const original = useNostrIdentityStore.getState().identities
    const persistSecrets = jest
      .spyOn(nostrSecrets, 'persistIdentitySecretsSafe')
      .mockResolvedValue()

    addIdentity({
      createdAt: Date.now(),
      isWatchOnly: true,
      npub: 'npub1owned'
    })

    expect(persistSecrets).not.toHaveBeenCalled()
    expect(useNostrIdentityStore.getState().identities).toStrictEqual(original)
    persistSecrets.mockRestore()
  })

  it('addIdentity restores the keys of a known identity that has none', () => {
    const { addIdentity } = useNostrIdentityStore.getState()
    addIdentity({ createdAt: Date.now(), isWatchOnly: true, npub: 'npub1keys' })

    addIdentity({
      createdAt: Date.now(),
      isWatchOnly: false,
      npub: 'npub1keys',
      nsec: 'nsec1keys'
    })

    expect(useNostrIdentityStore.getState().identities).toStrictEqual([
      expect.objectContaining({ isWatchOnly: false, nsec: 'nsec1keys' })
    ])
  })

  it('addIdentity keeps a disconnect choice when it restores keys', () => {
    const { addIdentity } = useNostrIdentityStore.getState()
    addIdentity({ createdAt: Date.now(), isWatchOnly: true, npub: 'npub1off' })

    addIdentity({
      createdAt: Date.now(),
      isWatchOnly: false,
      npub: 'npub1off',
      nsec: 'nsec1off',
      relayConnected: false
    })

    expect(useNostrIdentityStore.getState().identities).toStrictEqual([
      expect.objectContaining({ nsec: 'nsec1off', relayConnected: false })
    ])
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
