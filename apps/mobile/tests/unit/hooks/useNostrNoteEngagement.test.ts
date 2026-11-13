import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { NostrAPI } from '@/api/nostr'
import { nostrKeys } from '@/db/keys'
import { useNostrNoteEngagement } from '@/hooks/useNostrNoteEngagement'

jest.mock<Partial<typeof import('@/api/nostrEngagementFetcher')>>(
  '@/api/nostrEngagementFetcher',
  () => ({
    __esModule: true,
    fetchNoteEngagementCoalesced: jest.fn(() => Promise.resolve([]))
  })
)

const NOTE = { id: 'note-1', kind: 1, pubkey: 'author' }
const OWN_PUBKEY = 'me'
const RELAYS = ['wss://relay.example']

type Engagement = ReturnType<typeof useNostrNoteEngagement>

const mounted: ReactTestRenderer[] = []

function flushQueries() {
  return act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

async function renderEngagement(queryClient: QueryClient) {
  const result: { current: Engagement | null } = { current: null }
  function Harness() {
    result.current = useNostrNoteEngagement({
      enabled: true,
      isWatchOnly: false,
      note: NOTE,
      nsec: 'nsec1me',
      ownPubkey: OWN_PUBKEY,
      relays: RELAYS
    })
    return null
  }
  await act(async () => {
    mounted.push(
      create(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(Harness)
        )
      )
    )
  })
  await flushQueries()
  return result
}

function reactionsInvalidated(queryClient: QueryClient, relaysKey: string) {
  return queryClient
    .getQueryCache()
    .find({ queryKey: nostrKeys.identityNoteReactions(NOTE.id, relaysKey) })
    ?.state.isInvalidated
}

describe('useNostrNoteEngagement', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity },
      queries: { gcTime: Infinity, retry: false }
    }
  })

  beforeEach(() => {
    jest.spyOn(NostrAPI.prototype, 'disconnect').mockReturnValue()
    jest.spyOn(NostrAPI.prototype, 'publishReaction').mockResolvedValue({
      content: '+',
      created_at: 1,
      id: 'reaction-1',
      kind: 7,
      pubkey: OWN_PUBKEY,
      targetId: NOTE.id
    })
  })

  afterEach(() => {
    act(() => {
      for (const renderer of mounted.splice(0)) {
        renderer.unmount()
      }
    })
    queryClient.clear()
    jest.restoreAllMocks()
  })

  it('refreshes the note reactions list after a like', async () => {
    for (const relaysKey of ['relays-a', 'relays-b']) {
      queryClient.setQueryData(
        nostrKeys.identityNoteReactions(NOTE.id, relaysKey),
        { pageParams: [0], pages: [] }
      )
    }
    const engagement = await renderEngagement(queryClient)

    act(() => {
      engagement.current?.handleLikePress()
    })
    await flushQueries()

    expect(engagement.current?.likedByMe).toBe(true)
    expect(reactionsInvalidated(queryClient, 'relays-a')).toBe(true)
    expect(reactionsInvalidated(queryClient, 'relays-b')).toBe(true)
  })
})
