import { fetchNoteEngagementCoalesced } from '@/api/nostrEngagementFetcher'
import { NOSTR_ENGAGEMENT_BATCH_SIZE } from '@/constants/nostr'

const mockFetchEngagement = jest.fn()
const mockDisconnect = jest.fn()

jest.mock<typeof import('@/api/nostr')>('@/api/nostr', () => ({
  NostrAPI: jest.fn(() => ({
    disconnect: mockDisconnect,
    fetchEngagement: mockFetchEngagement
  }))
}))

const RELAYS = ['wss://relay.test']
const OWN = 'f'.repeat(64)

function likeOf(noteId: string) {
  return {
    content: '+',
    created_at: 1,
    id: `like-${noteId}`,
    kind: 7,
    pubkey: OWN,
    targetId: noteId
  }
}

describe('fetchNoteEngagementCoalesced', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockFetchEngagement.mockReset()
    mockDisconnect.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('batches notes requested together into one fetch', async () => {
    mockFetchEngagement.mockImplementation((noteIds: string[]) =>
      Promise.resolve(noteIds.map(likeOf))
    )

    const first = fetchNoteEngagementCoalesced('n1', RELAYS, OWN)
    const second = fetchNoteEngagementCoalesced('n2', RELAYS, OWN)
    await jest.runAllTimersAsync()

    await expect(first).resolves.toStrictEqual([likeOf('n1')])
    await expect(second).resolves.toStrictEqual([likeOf('n2')])
    expect(mockFetchEngagement).toHaveBeenCalledTimes(1)
    expect(mockFetchEngagement).toHaveBeenCalledWith(['n1', 'n2'], OWN)
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it('resolves notes without engagement to an empty list', async () => {
    mockFetchEngagement.mockResolvedValue([])

    const result = fetchNoteEngagementCoalesced('quiet', RELAYS, OWN)
    await jest.runAllTimersAsync()

    await expect(result).resolves.toStrictEqual([])
  })

  it('splits large windows into chunks', async () => {
    mockFetchEngagement.mockResolvedValue([])
    const noteIds = Array.from(
      { length: NOSTR_ENGAGEMENT_BATCH_SIZE + 1 },
      (_, index) => `n${index}`
    )

    const results = noteIds.map((noteId) =>
      fetchNoteEngagementCoalesced(noteId, RELAYS, OWN)
    )
    await jest.runAllTimersAsync()
    await Promise.all(results)

    expect(mockFetchEngagement).toHaveBeenCalledTimes(2)
  })

  it('rejects every waiter when the fetch fails', async () => {
    mockFetchEngagement.mockRejectedValue(new Error('no relays'))

    const result = fetchNoteEngagementCoalesced('n1', RELAYS, OWN).catch(
      (error: unknown) => error
    )
    await jest.runAllTimersAsync()

    await expect(result).resolves.toThrow('no relays')
  })
})
