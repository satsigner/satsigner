jest.mock('nostr-tools', () => jest.requireActual('nostr-tools'))

import { NostrAPI } from '@/api/nostr'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { getNostrIdentityRelays } from '@/utils/nostrContacts'

describe('getNostrIdentityRelays', () => {
  it('prefers the identity relay list', () => {
    expect(
      getNostrIdentityRelays(['wss://identity.relay'], ['wss://store.relay'])
    ).toEqual(['wss://identity.relay'])
  })

  it('falls back to the store list when identity has none', () => {
    expect(getNostrIdentityRelays([], ['wss://store.relay'])).toEqual([
      'wss://store.relay'
    ])
    expect(getNostrIdentityRelays(undefined, ['wss://store.relay'])).toEqual([
      'wss://store.relay'
    ])
  })

  it('falls back to indexing relays when both are empty', () => {
    expect(getNostrIdentityRelays(undefined, [])).toEqual(
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
})
