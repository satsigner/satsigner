import { getEventContent } from '@/hooks/useNostrMessageProcessor'
import { type NostrUnwrappedEvent } from '@/types/models/Nostr'
import { compressMessage } from '@/utils/nostr'

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

function unwrappedEvent(content: string): NostrUnwrappedEvent {
  return { content, id: 'event-123', pubkey: 'a'.repeat(64) }
}

describe('getEventContent', () => {
  it('parses JSON object content', () => {
    const content = '{"created_at":1704067200,"description":"hello"}'
    expect(getEventContent(unwrappedEvent(content))).toStrictEqual({
      created_at: 1704067200,
      description: 'hello'
    })
  })

  it('decodes compressed content', () => {
    const payload = { created_at: 1704067200, description: 'hello' }
    expect(
      getEventContent(unwrappedEvent(compressMessage(payload)))
    ).toStrictEqual(payload)
  })

  it.each(['null', '42', '"text"', '[1,2]', 'not json'])(
    'falls back to the raw content for %s',
    (content) => {
      expect(getEventContent(unwrappedEvent(content))).toStrictEqual({
        raw: content
      })
    }
  )
})
