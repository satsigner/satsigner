import NDK from '@nostr-dev-kit/ndk'
import {
  generateSecretKey,
  getPublicKey,
  nip19,
  nip44,
  nip59
} from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_UI_FLUSH_INTERVAL_MS } from '@/constants/nostr'
import { isNostrEventProcessed } from '@/db/nostrProcessedEvents'

// The repo-wide manual mock stubs the crypto these tests exercise.
jest.unmock('nostr-tools')
jest.mock('@nostr-dev-kit/ndk')
jest.mock<typeof import('@/db/nostrProcessedEvents')>(
  '@/db/nostrProcessedEvents',
  () => ({
    isNostrEventProcessed: jest.fn().mockReturnValue(false)
  })
)
jest.mock<typeof import('sonner-native')>('sonner-native', () => ({
  toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() }
}))

type WrapEvent = ReturnType<typeof nip59.wrapEvent>
type SubscriptionHandlers = Record<string, (...args: unknown[]) => void>

const RELAYS = ['wss://relay.test']
// Above the old 300-event cap that dropped the oldest queued events.
const LARGE_BATCH = 320
const LARGE_BATCH_TIMEOUT_MS = 60_000

const recipientSecret = generateSecretKey()
const recipientNsec = nip19.nsecEncode(recipientSecret)
const recipientNpub = nip19.npubEncode(getPublicKey(recipientSecret))
const senderSecret = generateSecretKey()

function wrapTo(recipientPubkey: string, text: string): WrapEvent {
  return nip59.wrapEvent(
    { content: text, kind: 14, tags: [['p', recipientPubkey]] },
    senderSecret,
    recipientPubkey
  )
}

function toNdkEvent(wrap: WrapEvent) {
  return {
    id: wrap.id,
    pubkey: wrap.pubkey,
    toNostrEvent: () => Promise.resolve(wrap)
  }
}

async function subscribe(callback: jest.Mock, processedScope?: string) {
  const handlers: SubscriptionHandlers = {}
  jest.spyOn(NDK.prototype, 'subscribe').mockReturnValue({
    on: (event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler
    },
    stop: jest.fn()
  })
  const api = new NostrAPI(RELAYS)
  await api.subscribeToKind1059(
    recipientNsec,
    recipientNpub,
    callback,
    undefined,
    undefined,
    undefined,
    { processedScope }
  )
  return {
    api,
    deliver: async (wrap: WrapEvent) => {
      handlers.event(toNdkEvent(wrap))
      await jest.advanceTimersByTimeAsync(0)
    },
    handlers
  }
}

function deliveredIds(callback: jest.Mock): string[] {
  return callback.mock.calls.flatMap(([messages]: [{ id: string }[]]) =>
    messages.map((message) => message.id)
  )
}

describe('nostrAPI gift-wrap queue', () => {
  const recipientPubkey = getPublicKey(recipientSecret)

  beforeEach(() => {
    jest.useFakeTimers()
    jest.mocked(isNostrEventProcessed).mockReturnValue(false)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it(
    'hands every event to the callback without dropping any',
    async () => {
      const callback = jest.fn().mockResolvedValue(undefined)
      const { api, deliver } = await subscribe(callback)
      const wraps = Array.from({ length: LARGE_BATCH }, (_, index) =>
        wrapTo(recipientPubkey, `message ${index}`)
      )

      for (const wrap of wraps) {
        await deliver(wrap)
      }
      await api.flushQueue()

      expect(deliveredIds(callback)).toHaveLength(LARGE_BATCH)
      expect(callback.mock.calls[0][0][0].wrapId).toBe(wraps[0].id)
      expect(api.getPendingEventCount()).toBe(0)
    },
    LARGE_BATCH_TIMEOUT_MS
  )

  it('coalesces events into one callback per flush interval', async () => {
    const callback = jest.fn().mockResolvedValue(undefined)
    const { deliver } = await subscribe(callback)

    await deliver(wrapTo(recipientPubkey, 'a'))
    await deliver(wrapTo(recipientPubkey, 'b'))
    expect(callback).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(NOSTR_UI_FLUSH_INTERVAL_MS)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][0]).toHaveLength(2)
  })

  it('remembers events only after the callback resolved', async () => {
    const callback = jest.fn().mockResolvedValue(undefined)
    const { api, deliver } = await subscribe(callback)
    const wrap = wrapTo(recipientPubkey, 'once')

    await deliver(wrap)
    await api.flushQueue()
    await deliver(wrap)
    await api.flushQueue()

    expect(deliveredIds(callback)).toHaveLength(1)
  })

  it('forgets a batch whose callback failed so a redelivery retries it', async () => {
    const callback = jest
      .fn()
      .mockRejectedValueOnce(new Error('store failed'))
      .mockResolvedValue(undefined)
    const { api, deliver } = await subscribe(callback)
    const wrap = wrapTo(recipientPubkey, 'retry me')

    await deliver(wrap)
    await api.flushQueue()
    await deliver(wrap)
    await api.flushQueue()

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('skips wraps already processed in SQLite before decrypting', async () => {
    jest.mocked(isNostrEventProcessed).mockReturnValue(true)
    const decrypt = jest.spyOn(nip44.v2, 'decrypt')
    const callback = jest.fn().mockResolvedValue(undefined)
    const { api, deliver } = await subscribe(callback, 'account-1')

    await deliver(wrapTo(recipientPubkey, 'seen'))
    await api.flushQueue()

    expect(isNostrEventProcessed).toHaveBeenCalledWith(
      'account-1',
      expect.any(String)
    )
    expect(decrypt).not.toHaveBeenCalled()
    expect(callback).not.toHaveBeenCalled()
  })

  it('flushes only events queued before gift-wrap intake stopped', async () => {
    const callback = jest.fn().mockResolvedValue(undefined)
    const { api, deliver, handlers } = await subscribe(callback)
    const queued = wrapTo(recipientPubkey, 'before shutdown')
    const late = wrapTo(recipientPubkey, 'after shutdown')
    const lateEvent: { resolve?: (wrap: WrapEvent) => void } = {}

    await deliver(queued)
    handlers.event({
      id: late.id,
      pubkey: late.pubkey,
      toNostrEvent: () =>
        new Promise<WrapEvent>((resolve) => {
          lateEvent.resolve = resolve
        })
    })
    api.stopGiftWrapIntake()
    lateEvent.resolve?.(late)
    await jest.advanceTimersByTimeAsync(0)
    await api.flushQueue()

    expect(deliveredIds(callback)).toHaveLength(1)
    expect(callback.mock.calls[0][0][0].wrapId).toBe(queued.id)
  })

  it('does not decrypt a wrap again after it failed once', async () => {
    const decrypt = jest.spyOn(nip44.v2, 'decrypt')
    const callback = jest.fn().mockResolvedValue(undefined)
    const foreignWrap = wrapTo(getPublicKey(generateSecretKey()), 'not ours')

    const first = await subscribe(callback)
    await first.deliver(foreignWrap)
    first.api.closeAllSubscriptions()
    const decryptsAfterFirst = decrypt.mock.calls.length

    const second = await subscribe(callback)
    await second.deliver(foreignWrap)

    expect(decryptsAfterFirst).toBeGreaterThan(0)
    expect(decrypt).toHaveBeenCalledTimes(decryptsAfterFirst)
    expect(callback).not.toHaveBeenCalled()
  })
})
