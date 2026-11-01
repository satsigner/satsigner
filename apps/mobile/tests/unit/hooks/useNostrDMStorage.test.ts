import { nip19 } from 'nostr-tools'

import { buildNewMessage, storeNostrDmBatch } from '@/hooks/useNostrDMStorage'
import { type NostrDM, type NostrUnwrappedEvent } from '@/types/models/Nostr'

jest.mock<typeof import('sonner-native')>('sonner-native', () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn()
  }
}))

// Device/npub matching needs real bech32, not the repo-wide manual mock.
jest.unmock('nostr-tools')

const mockAccountsState: {
  accounts: unknown[]
  addAccountDms: jest.Mock
  replaceAccountDm: jest.Mock
} = { accounts: [], addAccountDms: jest.fn(), replaceAccountDm: jest.fn() }

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: { getState: () => mockAccountsState }
}))

jest.mock<typeof import('@/store/nostr')>('@/store/nostr', () => ({
  useNostrStore: {
    getState: () => ({})
  }
}))

const CREATED_AT = 1_704_067_200

const unwrappedEvent: NostrUnwrappedEvent = {
  content: '',
  created_at: CREATED_AT,
  id: 'event-123',
  pubkey: 'b'.repeat(64)
}

describe('buildNewMessage', () => {
  it('builds the stored DM from the event content', () => {
    expect(
      buildNewMessage(unwrappedEvent, {
        created_at: CREATED_AT,
        description: 'hello'
      })
    ).toStrictEqual({
      author: unwrappedEvent.pubkey,
      content: {
        created_at: CREATED_AT,
        description: 'hello',
        pubkey: unwrappedEvent.pubkey
      },
      created_at: CREATED_AT,
      description: 'hello',
      event: JSON.stringify(unwrappedEvent),
      id: unwrappedEvent.id,
      label: 1
    })
  })

  it('uses an empty description when the content has no text', () => {
    expect(
      buildNewMessage(unwrappedEvent, { created_at: CREATED_AT })?.description
    ).toBe('')
    expect(
      buildNewMessage(unwrappedEvent, {
        created_at: CREATED_AT,
        description: 7
      })?.description
    ).toBe('')
  })

  it('skips content without a numeric created_at', () => {
    expect(buildNewMessage(unwrappedEvent, { description: 'hello' })).toBeNull()
    expect(
      buildNewMessage(unwrappedEvent, {
        created_at: String(CREATED_AT),
        description: 'hello'
      })
    ).toBeNull()
  })
})

describe('storeNostrDmBatch', () => {
  const deviceHex = 'b'.repeat(64)
  const peerHex = 'c'.repeat(64)
  const nowSec = Math.floor(Date.now() / 1000)

  function eventFrom(pubkey: string, id: string): NostrUnwrappedEvent {
    return { content: '', created_at: nowSec, id, pubkey }
  }

  function setStoredDms(dms: NostrDM[]) {
    mockAccountsState.accounts = [
      {
        id: 'account-1',
        nostr: {
          deviceNpub: nip19.npubEncode(deviceHex),
          dms,
          syncStart: new Date(),
          trustedMemberDevices: [nip19.npubEncode(peerHex)]
        }
      }
    ]
  }

  beforeEach(() => {
    mockAccountsState.addAccountDms.mockClear()
    mockAccountsState.replaceAccountDm.mockClear()
  })

  it('writes only new DMs from allowed senders in one call', () => {
    setStoredDms([])

    const outcome = storeNostrDmBatch('account-1', [
      {
        eventContent: { created_at: nowSec, description: 'hi' },
        unwrappedEvent: eventFrom(peerHex, 'peer-1')
      },
      {
        eventContent: { created_at: nowSec, description: 'spam' },
        unwrappedEvent: eventFrom('d'.repeat(64), 'stranger-1')
      }
    ])

    expect(mockAccountsState.addAccountDms).toHaveBeenCalledTimes(1)
    const [[, written]] = mockAccountsState.addAccountDms.mock.calls
    expect(written.map((dm: NostrDM) => dm.id)).toStrictEqual(['peer-1'])
    expect(written[0].read).toBe(false)
    expect(outcome.deferredIds).toStrictEqual(['stranger-1'])
  })

  it('replaces the optimistic copy when the relay echoes our own message', () => {
    setStoredDms([
      {
        author: deviceHex,
        created_at: nowSec,
        description: 'sent from here',
        event: '',
        id: 'pending-1',
        label: 1
      }
    ])

    storeNostrDmBatch('account-1', [
      {
        eventContent: { created_at: nowSec, description: 'sent from here' },
        unwrappedEvent: eventFrom(deviceHex, 'real-1')
      }
    ])

    expect(mockAccountsState.replaceAccountDm).toHaveBeenCalledWith(
      'account-1',
      'pending-1',
      expect.objectContaining({ id: 'real-1' })
    )
    expect(mockAccountsState.addAccountDms).toHaveBeenCalledWith(
      'account-1',
      []
    )
  })
})
