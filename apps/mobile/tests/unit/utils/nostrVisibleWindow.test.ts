jest.mock<typeof import('@/api/nostrProfileFetcher')>(
  '@/api/nostrProfileFetcher',
  () => ({
    fetchProfileCoalesced: jest.fn(),
    fetchProfileResult: jest.fn(),
    fetchProfilesCoalesced: jest.fn(),
    forceProfileFetch: jest.fn(),
    queueProfileFetch: jest.fn(),
    queueProfileFetches: jest.fn(),
    resetProfileFetcher: jest.fn()
  })
)

import { fetchProfilesCoalesced } from '@/api/nostrProfileFetcher'
import {
  NOSTR_VISIBLE_WINDOW_AHEAD,
  NOSTR_VISIBLE_WINDOW_BEHIND
} from '@/constants/nostr'
import { requestWindowProfiles } from '@/hooks/useNostrVisibleItemsTrack'
import { useNostrProfilesStore } from '@/store/nostrProfiles'
import type { NostrKind0Profile } from '@/types/models/Nostr'
import {
  collectWindowPubkeys,
  getVisibleWindowRange
} from '@/utils/nostrVisibleWindow'

const PK_A = 'a'.repeat(64)
const PK_B = 'b'.repeat(64)
const RELAYS = ['wss://relay.one']

describe('getVisibleWindowRange', () => {
  it('adds the window ahead and behind, clamped to the list', () => {
    expect(getVisibleWindowRange([10, 11, 12], 100)).toStrictEqual({
      end: 12 + NOSTR_VISIBLE_WINDOW_AHEAD,
      start: 10 - NOSTR_VISIBLE_WINDOW_BEHIND
    })
    expect(getVisibleWindowRange([0, 1], 3)).toStrictEqual({ end: 2, start: 0 })
  })

  it('is null when nothing is visible', () => {
    expect(getVisibleWindowRange([], 10)).toBeNull()
  })
})

describe('collectWindowPubkeys', () => {
  it('returns unique valid lowercase pubkeys for items in range only', () => {
    const items = [[PK_A], [PK_A.toUpperCase(), 'bad'], [PK_B]]
    expect(
      collectWindowPubkeys(items, { end: 1, start: 0 }, (keys) => keys)
    ).toStrictEqual([PK_A])
  })
})

describe('requestWindowProfiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useNostrProfilesStore.getState().clearProfiles()
  })

  it('sends each pubkey to the batcher once while it is loading', async () => {
    const pending: {
      resolve: (batch: Map<string, NostrKind0Profile>) => void
    } = { resolve: () => undefined }
    function holdBatch(): Promise<Map<string, NostrKind0Profile>> {
      return new Promise((resolve) => {
        pending.resolve = resolve
      })
    }
    jest.mocked(fetchProfilesCoalesced).mockImplementation(holdBatch)

    const first = requestWindowProfiles([PK_A, PK_B], RELAYS)
    const second = requestWindowProfiles([PK_A, PK_B], RELAYS)
    pending.resolve(new Map([[PK_A, { displayName: 'alice' }]]))
    await Promise.all([first, second])

    expect(fetchProfilesCoalesced).toHaveBeenCalledTimes(1)
    expect(useNostrProfilesStore.getState().profiles).toStrictEqual({
      [PK_A]: { displayName: 'alice' },
      [PK_B]: null
    })
  })

  it('skips pubkeys whose profile is already loaded', async () => {
    useNostrProfilesStore
      .getState()
      .setProfiles([PK_A], new Map([[PK_A, { displayName: 'alice' }]]))
    jest.mocked(fetchProfilesCoalesced).mockResolvedValue(new Map())

    await requestWindowProfiles([PK_A, PK_B], RELAYS)

    expect(fetchProfilesCoalesced).toHaveBeenCalledWith([PK_B], RELAYS)
  })

  it('keeps the profiles record identity when nothing changed', async () => {
    useNostrProfilesStore
      .getState()
      .setProfiles([PK_A], new Map([[PK_A, { displayName: 'alice' }]]))
    const before = useNostrProfilesStore.getState().profiles

    useNostrProfilesStore
      .getState()
      .setProfiles([PK_A], new Map([[PK_A, { displayName: 'alice' }]]))

    expect(useNostrProfilesStore.getState().profiles).toBe(before)
  })
})
