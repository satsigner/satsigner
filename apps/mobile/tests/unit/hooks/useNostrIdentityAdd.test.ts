import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import { useNostrIdentityAdd } from '@/hooks/useNostrIdentityAdd'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { type NostrIdentity } from '@/types/models/Nostr'
import {
  connectedRelayUrls,
  hasNostrRelaysSelected,
  nostrAccountRelayCount,
  nostrConnectedDetail,
  nostrConnectedSummary,
  relayEditorSelection,
  relayStatusNote
} from '@/utils/nostrIdentity'

type IdentityAdd = ReturnType<typeof useNostrIdentityAdd>

const IDENTITY: NostrIdentity = {
  createdAt: 0,
  isWatchOnly: true,
  npub: 'npub1example'
}

function renderIdentityAdd(onAdded: () => void) {
  const result: { current: IdentityAdd | null } = { current: null }
  function Harness() {
    result.current = useNostrIdentityAdd(onAdded)
    return null
  }
  act(() => {
    create(createElement(Harness))
  })
  return result
}

function storedNpubs() {
  return useNostrIdentityStore.getState().identities.map((i) => i.npub)
}

function storedIdentity() {
  return useNostrIdentityStore.getState().identities.at(0)
}

describe('useNostrIdentityAdd', () => {
  beforeEach(() => {
    useNostrIdentityStore.setState({
      activeIdentityNpub: null,
      identities: [],
      kind0FetchWarningDismissed: false,
      relays: []
    })
  })

  it('shows the warning instead of adding on first use', () => {
    const onAdded = jest.fn()
    const result = renderIdentityAdd(onAdded)

    act(() => result.current?.requestAdd(IDENTITY))

    expect(result.current?.warningVisible).toBe(true)
    expect(storedNpubs()).toStrictEqual([])
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('fetches once without dismissing the warning', () => {
    const onAdded = jest.fn()
    const result = renderIdentityAdd(onAdded)

    act(() => result.current?.requestAdd(IDENTITY))
    act(() => result.current?.fetchProfile())

    expect(storedNpubs()).toStrictEqual([IDENTITY.npub])
    expect(storedIdentity()?.relayConnected).toBe(true)
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(result.current?.warningVisible).toBe(false)
    expect(useNostrIdentityStore.getState().kind0FetchWarningDismissed).toBe(
      false
    )
  })

  it('fetches and stops asking when told to', () => {
    const result = renderIdentityAdd(jest.fn())

    act(() => result.current?.requestAdd(IDENTITY))
    act(() => result.current?.fetchProfileAlways())

    expect(storedIdentity()?.relayConnected).toBe(true)
    expect(useNostrIdentityStore.getState().kind0FetchWarningDismissed).toBe(
      true
    )
  })

  it('saves disconnected from relays when not fetching', () => {
    const onAdded = jest.fn()
    const result = renderIdentityAdd(onAdded)

    act(() => result.current?.requestAdd(IDENTITY))
    act(() => result.current?.saveWithoutFetching())

    expect(storedNpubs()).toStrictEqual([IDENTITY.npub])
    expect(storedIdentity()?.relayConnected).toBe(false)
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(result.current?.warningVisible).toBe(false)
    expect(useNostrIdentityStore.getState().kind0FetchWarningDismissed).toBe(
      false
    )
  })

  it('adds directly once the warning was dismissed', () => {
    useNostrIdentityStore.setState({ kind0FetchWarningDismissed: true })
    const onAdded = jest.fn()
    const result = renderIdentityAdd(onAdded)

    act(() => result.current?.requestAdd(IDENTITY))

    expect(result.current?.warningVisible).toBe(false)
    expect(storedNpubs()).toStrictEqual([IDENTITY.npub])
    expect(onAdded).toHaveBeenCalledTimes(1)
  })
})

describe('hasNostrRelaysSelected', () => {
  it('is false when neither the identity nor the store has relays', () => {
    expect(hasNostrRelaysSelected(undefined, [])).toBe(false)
    expect(hasNostrRelaysSelected([], [])).toBe(false)
  })

  it('is true when either list has relays', () => {
    expect(hasNostrRelaysSelected(['wss://a'], [])).toBe(true)
    expect(hasNostrRelaysSelected(undefined, ['wss://b'])).toBe(true)
  })
})

describe('nostrAccountRelayCount', () => {
  const configured = [
    'wss://indexer.coracle.social',
    'wss://relay.nos.social',
    'wss://relay.primal.net',
    'wss://relay.snort.social'
  ]

  it('counts only the relays that connected', () => {
    expect(
      nostrAccountRelayCount(configured, {
        relayDetails: [
          { connected: true, url: 'wss://indexer.coracle.social' },
          { connected: true, url: 'wss://relay.nos.social' },
          { connected: false, url: 'wss://relay.nostr.band' }
        ],
        status: 'connected'
      })
    ).toBe(2)
  })

  it('uses the configured list when nothing is connected', () => {
    expect(
      nostrAccountRelayCount(configured, {
        reason: 'no_relays',
        status: 'disconnected'
      })
    ).toBe(configured.length)
  })
})

describe('relayEditorSelection', () => {
  const connected = ['wss://indexer.coracle.social', 'wss://relay.nos.social']

  it('checks the connected relays when nothing was saved', () => {
    expect(relayEditorSelection([], connected, null)).toStrictEqual(connected)
  })

  it('keeps an explicit list instead of the live connections', () => {
    expect(
      relayEditorSelection(['wss://relay.primal.net'], connected, null)
    ).toStrictEqual(['wss://relay.primal.net'])
  })

  it('keeps the user override', () => {
    expect(
      relayEditorSelection([], connected, ['wss://relay.snort.social'])
    ).toStrictEqual(['wss://relay.snort.social'])
  })
})

describe('nostrConnectedSummary', () => {
  const info = {
    relayDetails: [
      { connected: true, url: 'wss://relay.nos.social' },
      { connected: false, url: 'wss://relay.primal.net' }
    ],
    status: 'connected' as const
  }

  it('names the live connection against the larger selected list', () => {
    expect(nostrConnectedSummary(info, 8)).toBe('1 of 8 connected')
    expect(nostrConnectedDetail(info, 8)).toBe('1 of 8 connected relays')
  })

  it('stays a plain connected label when every selected relay answered', () => {
    expect(nostrConnectedSummary(info, 1)).toBe('Connected')
  })
})

describe('relayStatusNote', () => {
  const info = {
    relayDetails: [
      { connected: true, url: 'wss://relay.nos.social' },
      { connected: false, error: 'timeout', url: 'wss://relay.primal.net' },
      { connected: false, error: '403', url: 'wss://relay.snort.social' }
    ],
    status: 'connected' as const
  }

  it('uses green-path copy when the relay answered', () => {
    expect(
      relayStatusNote('wss://relay.nos.social/', info, false)
    ).toStrictEqual({
      label: 'Connected',
      tone: 'ok'
    })
  })

  it('explains a timeout and any other error', () => {
    expect(relayStatusNote('wss://relay.primal.net', info, false)?.label).toBe(
      'Timed out'
    )
    expect(
      relayStatusNote('wss://relay.snort.social', info, false)
    ).toStrictEqual({
      label: '403',
      tone: 'bad'
    })
  })
})

describe('connectedRelayUrls', () => {
  it('returns the urls that answered', () => {
    expect(
      connectedRelayUrls({
        relayDetails: [
          { connected: true, url: 'wss://indexer.coracle.social' },
          { connected: false, url: 'wss://relay.primal.net' }
        ],
        status: 'connected'
      })
    ).toStrictEqual(['wss://indexer.coracle.social'])
  })
})
