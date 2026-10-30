import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import { useNostrIdentityAdd } from '@/hooks/useNostrIdentityAdd'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { type NostrIdentity } from '@/types/models/Nostr'
import { hasNostrRelaysSelected } from '@/utils/nostrIdentity'

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
