import { buildNewMessage } from '@/hooks/useNostrDMStorage'
import { type NostrUnwrappedEvent } from '@/types/models/Nostr'

jest.mock<typeof import('sonner-native')>('sonner-native', () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn()
  }
}))

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: {
    getState: () => ({ accounts: [] })
  }
}))

jest.mock<typeof import('@/store/nostr')>('@/store/nostr', () => ({
  useNostrStore: {
    getState: () => ({})
  }
}))

const CREATED_AT = 1704067200

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
