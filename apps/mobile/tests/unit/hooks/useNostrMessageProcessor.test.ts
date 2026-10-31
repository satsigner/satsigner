import { NOSTR_EVENT_MAX_HANDLER_ATTEMPTS } from '@/constants/nostr'
import { markNostrEventsProcessed } from '@/db/nostrProcessedEvents'
import { isSenderAllowed, storeNostrDmBatch } from '@/hooks/useNostrDMStorage'
import { processMessage } from '@/hooks/useNostrHandlersRegistry'
import {
  getEventContent,
  processNostrEventBatch,
  resetHandlerFailures
} from '@/hooks/useNostrMessageProcessor'
import { type Account } from '@/types/models/Account'
import { type NostrUnwrappedEvent } from '@/types/models/Nostr'
import { compressMessage } from '@/utils/nostr'

const mockProcessedIds = new Set<string>()

jest.mock<typeof import('@/db/nostrProcessedEvents')>(
  '@/db/nostrProcessedEvents',
  () => ({
    getProcessedNostrEventIds: jest.fn(
      (_scope: string, ids: string[]) =>
        new Set(ids.filter((id) => mockProcessedIds.has(id)))
    ),
    markNostrEventsProcessed: jest.fn(
      (_scope: string, events: { id: string }[]) => {
        for (const { id } of events) {
          mockProcessedIds.add(id)
        }
      }
    )
  })
)

jest.mock<typeof import('@/hooks/useNostrHandlersRegistry')>(
  '@/hooks/useNostrHandlersRegistry',
  () => ({
    isInitialized: jest.fn(() => true),
    processMessage: jest.fn(),
    registerHandler: jest.fn(),
    setInitialized: jest.fn()
  })
)

jest.mock<typeof import('@/hooks/useNostrDMStorage')>(
  '@/hooks/useNostrDMStorage',
  () => ({
    getSyncStartSeconds: jest.fn().mockReturnValue(0),
    isSenderAllowed: jest.fn(),
    storeNostrDmBatch: jest.fn()
  })
)

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
    getState: () => ({ getLastDataExchangeEOSE: () => 0 })
  }
}))

function unwrappedEvent(content: string): NostrUnwrappedEvent {
  return { content, id: 'event-123', pubkey: 'a'.repeat(64) }
}

describe('getEventContent', () => {
  it('parses JSON object content', () => {
    const content = '{"created_at":1704067200,"description":"hello"}'
    expect(getEventContent(unwrappedEvent(content))).toStrictEqual({
      created_at: 1_704_067_200,
      description: 'hello'
    })
  })

  it('decodes compressed content', () => {
    const payload = { created_at: 1_704_067_200, description: 'hello' }
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

describe('processNostrEventBatch', () => {
  const account = {
    id: 'account-1',
    nostr: { syncStart: new Date(0) }
  } as unknown as Account

  function rumor(id: string, createdAt: number, content = '{}') {
    return {
      content: { content, created_at: createdAt, id, pubkey: 'a'.repeat(64) },
      created_at: createdAt,
      id,
      wrapId: `wrap-${id}`
    }
  }

  beforeEach(() => {
    mockProcessedIds.clear()
    jest.clearAllMocks()
    jest.mocked(processMessage).mockResolvedValue({ status: 'handled' })
    jest.mocked(storeNostrDmBatch).mockReturnValue({ deferredIds: [] })
    jest.mocked(isSenderAllowed).mockReturnValue(true)
    resetHandlerFailures()
  })

  it('marks rumor and wrap ids processed after the handler succeeded', async () => {
    const result = await processNostrEventBatch(account, [rumor('e1', 10)])

    expect(result).toStrictEqual({
      deferred: [],
      failed: [],
      ignored: [],
      processed: [{ createdAt: 10, id: 'e1' }]
    })
    expect(markNostrEventsProcessed).toHaveBeenCalledWith('account-1', [
      { createdAt: 10, id: 'e1' },
      { createdAt: 10, id: 'wrap-e1' }
    ])
  })

  it('leaves an event whose handler threw unprocessed and keeps going', async () => {
    jest
      .mocked(processMessage)
      .mockResolvedValueOnce({ error: new Error('boom'), status: 'failed' })

    const result = await processNostrEventBatch(account, [
      rumor('bad', 10),
      rumor('good', 20)
    ])

    expect(result.failed).toStrictEqual([{ createdAt: 10, id: 'bad' }])
    expect(result.processed).toStrictEqual([{ createdAt: 20, id: 'good' }])
    expect(mockProcessedIds.has('bad')).toBe(false)
    expect(mockProcessedIds.has('good')).toBe(true)
  })

  it('keeps DM events unprocessed when the DM write fails', async () => {
    jest.mocked(processMessage).mockImplementation((context) => {
      if (context.unwrappedEvent.id === 'dm') {
        context.onPendingDM({
          eventContent: {},
          unwrappedEvent: context.unwrappedEvent
        })
      }
      return Promise.resolve({ status: 'handled' })
    })
    jest.mocked(storeNostrDmBatch).mockImplementation(() => {
      throw new Error('sqlite busy')
    })

    const result = await processNostrEventBatch(account, [
      rumor('dm', 10),
      rumor('label', 20)
    ])

    expect(result.failed).toStrictEqual([{ createdAt: 10, id: 'dm' }])
    expect(result.processed).toStrictEqual([{ createdAt: 20, id: 'label' }])
  })

  it('skips events already processed in SQLite', async () => {
    mockProcessedIds.add('seen')

    await processNostrEventBatch(account, [rumor('seen', 10)])

    expect(processMessage).not.toHaveBeenCalled()
  })

  it('processes every event of a large batch (no drop at 500+)', async () => {
    const events = Array.from({ length: 650 }, (_, index) =>
      rumor(`e${index}`, index)
    )

    const result = await processNostrEventBatch(account, events)

    expect(result.processed).toHaveLength(650)
    expect(processMessage).toHaveBeenCalledTimes(650)
  })

  it('defers events from untrusted senders without marking them', async () => {
    jest.mocked(isSenderAllowed).mockReturnValue(false)

    const result = await processNostrEventBatch(account, [
      rumor('untrusted', 10, '{"description":"hi","created_at":10}')
    ])

    expect(result.deferred).toStrictEqual([{ createdAt: 10, id: 'untrusted' }])
    expect(result.processed).toStrictEqual([])
    expect(processMessage).not.toHaveBeenCalled()
    expect(mockProcessedIds.has('untrusted')).toBe(false)
  })

  it('handles untrusted device announcements without moving the cursor', async () => {
    jest.mocked(isSenderAllowed).mockReturnValue(false)

    const result = await processNostrEventBatch(account, [
      rumor('announce', 10, '{"public_key_bech32":"npub1other"}')
    ])

    expect(result.ignored).toStrictEqual([{ createdAt: 10, id: 'announce' }])
    expect(result.processed).toStrictEqual([])
    expect(mockProcessedIds.has('announce')).toBe(true)
  })

  it('defers future-dated rumors', async () => {
    const year2100 = 4_102_444_800

    const result = await processNostrEventBatch(account, [
      rumor('future', year2100)
    ])

    expect(result.deferred.map((event) => event.id)).toStrictEqual(['future'])
    expect(processMessage).not.toHaveBeenCalled()
    expect(markNostrEventsProcessed).toHaveBeenCalledWith('account-1', [])
  })

  it('defers DMs the DM store did not accept yet', async () => {
    jest.mocked(processMessage).mockImplementation((context) => {
      context.onPendingDM({
        eventContent: {},
        unwrappedEvent: context.unwrappedEvent
      })
      return Promise.resolve({ status: 'handled' })
    })
    jest.mocked(storeNostrDmBatch).mockReturnValue({ deferredIds: ['dm'] })

    const result = await processNostrEventBatch(account, [rumor('dm', 10)])

    expect(result.deferred).toStrictEqual([{ createdAt: 10, id: 'dm' }])
    expect(mockProcessedIds.has('dm')).toBe(false)
  })

  it('gives up on an event after repeated handler failures', async () => {
    jest
      .mocked(processMessage)
      .mockResolvedValue({ error: new Error('boom'), status: 'failed' })

    const outcomes = []
    for (const _attempt of Array.from(
      { length: NOSTR_EVENT_MAX_HANDLER_ATTEMPTS },
      (_value, index) => index
    )) {
      outcomes.push(
        await processNostrEventBatch(account, [rumor('poison', 10)])
      )
    }

    expect(outcomes.at(-2)?.failed).toHaveLength(1)
    expect(outcomes.at(-1)?.ignored).toStrictEqual([
      { createdAt: 10, id: 'poison' }
    ])
    expect(mockProcessedIds.has('poison')).toBe(true)
  })
})
