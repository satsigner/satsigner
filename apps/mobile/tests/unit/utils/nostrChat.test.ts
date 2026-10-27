// Real nostr-tools for genuine NIP-04/NIP-17 crypto; NDK stays mocked (the
// manual mock preserves event fields) so no sockets are opened.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)
jest.mock('@nostr-dev-kit/ndk')

// In-memory chat message store — precise insert/dedup behavior without SQLite.
jest.mock<typeof import('@/db/mutations/nostrChat')>(
  '@/db/mutations/nostrChat',
  () => {
    const store = new Map<string, unknown>()
    return {
      __store: store,
      deleteChatMessagesForIdentity: jest.fn(),
      insertChatMessage: jest.fn((message: { id: string }) => {
        if (store.has(message.id)) {
          return false
        }
        store.set(message.id, message)
        return true
      }),
      markChatThreadRead: jest.fn(() => 0),
      updateChatMessageStatus: jest.fn()
    }
  }
)

jest.mock<typeof import('@/db/queries/nostrChat')>(
  '@/db/queries/nostrChat',
  () => {
    type MockStoredMessage = {
      created_at: number
      id: string
      protocol: string
      status: string
    }
    function storedMessages(): MockStoredMessage[] {
      const { __store } = jest.requireMock<{
        __store: Map<string, MockStoredMessage>
      }>('@/db/mutations/nostrChat')
      return [...__store.values()]
    }
    return {
      getNewestSentChatMessageCreatedAt: jest.fn(
        (_npub: string, protocol: string) => {
          const times = storedMessages()
            .filter((m) => m.protocol === protocol && m.status === 'sent')
            .map((m) => m.created_at)
          return times.length > 0 ? Math.max(...times) : null
        }
      ),
      getOldestChatMessageCreatedAt: jest.fn(() => null),
      hasChatMessage: jest.fn((_npub: string, id: string) =>
        storedMessages().some((m) => m.id === id)
      ),
      listChatConversations: jest.fn(() => []),
      listChatThread: jest.fn(() => [])
    }
  }
)

// In-memory decrypt-once ledger.
jest.mock<typeof import('@/db/nostrProcessedEvents')>(
  '@/db/nostrProcessedEvents',
  () => {
    const processed = new Set<string>()
    return {
      __processed: processed,
      chatProcessedScope: (npub: string) => `chat:${npub}`,
      clearNostrProcessedEvents: jest.fn(() => {
        processed.clear()
      }),
      countNostrProcessedEvents: jest.fn(() => processed.size),
      getNewestProcessedCreatedAt: jest.fn(() => null),
      getProcessedNostrEventIds: jest.fn(
        (scope: string, ids: string[]) =>
          new Set(ids.filter((id) => processed.has(`${scope}|${id}`)))
      ),
      isNostrEventProcessed: jest.fn((scope: string, id: string) =>
        processed.has(`${scope}|${id}`)
      ),
      markNostrEventsProcessed: jest.fn(
        (scope: string, events: { id: string }[]) => {
          for (const { id } of events) {
            processed.add(`${scope}|${id}`)
          }
        }
      ),
      pruneNostrProcessedEvents: jest.fn()
    }
  }
)

jest.mock<
  Pick<typeof import('@/utils/nostrLifecycle'), 'registerNostrLifecycleHandler'>
>('@/utils/nostrLifecycle', () => ({
  registerNostrLifecycleHandler: jest.fn(() => jest.fn())
}))

import NDK, { type NDKEvent } from '@nostr-dev-kit/ndk'
import { getPublicKey, nip19, nip44, nip59 } from 'nostr-tools'
import { decrypt as nip04Decrypt } from 'nostr-tools/nip04'

import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_CHAT_CATCH_UP_LIMIT,
  NOSTR_CHAT_INITIAL_HISTORY_LIMIT,
  NOSTR_CHAT_KIND4_CLOCK_SKEW_SEC,
  NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC
} from '@/constants/nostr'
import {
  insertChatMessage,
  updateChatMessageStatus
} from '@/db/mutations/nostrChat'
import { type NostrChatGiftWrap } from '@/types/models/Nostr'
import { NostrNoRelaysError } from '@/utils/errors'
import {
  acquireChatPipeline,
  addChatListener,
  clearRecipientRelaysCache,
  closeActiveChatPipeline,
  flushChatMessages,
  getChatLiveWindow,
  getChatPipelineApi,
  getChatPipelineStatus,
  ingestChatMessage,
  restartChatPipeline,
  sendNip04Chat,
  sendNip17Chat,
  subscribeToIdentityChat
} from '@/utils/nostrChat'
import { isSignedNdkEvent } from '@/utils/nostrEvent'

const senderSecretKey = new Uint8Array(32).fill(1)
const senderPubkey = getPublicKey(senderSecretKey)
const senderNpub = nip19.npubEncode(senderPubkey)
const senderNsec = nip19.nsecEncode(senderSecretKey)

const peerSecretKey = new Uint8Array(32).fill(2)
const peerPubkey = getPublicKey(peerSecretKey)
const peerNpub = nip19.npubEncode(peerPubkey)
const peerNsec = nip19.nsecEncode(peerSecretKey)

const sender = { npub: senderNpub, nsec: senderNsec }
const pipelineIdentity = { ...sender, relays: ['wss://test.relay'] }

type StoredMessage = Record<string, unknown>

function unwrapPublished(
  raw: Awaited<ReturnType<NDKEvent['toNostrEvent']>> | undefined,
  secretKey: Uint8Array
) {
  if (!raw || !isSignedNdkEvent(raw)) {
    throw new Error('expected a signed gift wrap')
  }
  return nip59.unwrapEvent(raw, secretKey)
}

const { __store: chatStore } = jest.requireMock<{
  __store: Map<string, StoredMessage>
}>('@/db/mutations/nostrChat')
const { __processed: processedWraps } = jest.requireMock<{
  __processed: Set<string>
}>('@/db/nostrProcessedEvents')

function storedMessages(): StoredMessage[] {
  return [...chatStore.values()]
}

/** Lets the background inbox-routing promise chain settle. */
async function flushBackground() {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
  }
}

type GiftWrapHandlers = {
  onWrap: (wrap: NostrChatGiftWrap) => void
  shouldUnwrap: (wrap: { createdAt: number; id: string }) => boolean
}

/** Fake pipeline API capturing the gift wrap handlers chat registers. */
function createFakeChatApi() {
  const captured: { handlers?: GiftWrapHandlers } = {}
  const api = new NostrAPI(['wss://test.relay'])
  jest
    .spyOn(api, 'subscribeToChatGiftWraps')
    .mockImplementation(async (_nsec, _npub, handlers) => {
      captured.handlers = handlers
    })
  jest.spyOn(api, 'subscribeToKind4').mockResolvedValue(undefined)
  return { api, captured }
}

function deliverRumor(
  handlers: GiftWrapHandlers | undefined,
  wrapId: string,
  rumor: Record<string, unknown>
) {
  const wrap = { createdAt: Number(rumor.created_at ?? 0), id: wrapId }
  if (handlers === undefined || !handlers.shouldUnwrap(wrap)) {
    return
  }
  handlers.onWrap({
    ...wrap,
    rumor: {
      content: '',
      created_at: 0,
      id: '',
      kind: 14,
      pubkey: '',
      tags: [],
      ...rumor
    }
  })
}

type CapturedSubscription = {
  filters: { kinds?: number[]; limit?: number; since?: number }[]
  handlers: Map<string, (...args: unknown[]) => void>
}

/** Records every REQ the real NostrAPI opens on the mocked NDK. */
function captureNdkSubscriptions(): CapturedSubscription[] {
  const subscriptions: CapturedSubscription[] = []
  jest.spyOn(NDK.prototype, 'subscribe').mockImplementation(((
    filters: CapturedSubscription['filters']
  ) => {
    const handlers = new Map<string, (...args: unknown[]) => void>()
    subscriptions.push({ filters, handlers })
    return {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, handler)
      },
      stop: jest.fn()
    }
  }) as never)
  return subscriptions
}

function findGiftWrapSubscriptions(subscriptions: CapturedSubscription[]) {
  return subscriptions.filter(
    (sub) => sub.filters[0]?.kinds?.includes(1059) === true
  )
}

describe('nostrChat', () => {
  beforeEach(() => {
    closeActiveChatPipeline()
    flushChatMessages()
    chatStore.clear()
    processedWraps.clear()
    clearRecipientRelaysCache()
    jest.restoreAllMocks()
    jest.clearAllMocks()
    // No recipient inbox relays in tests — skip the indexing-relay lookup.
    jest
      .spyOn(NostrAPI.prototype, 'fetchInboxRelaysForNpub')
      .mockResolvedValue([])
    jest
      .spyOn(NostrAPI.prototype, 'publishDmInboxRelayList')
      .mockResolvedValue(undefined)
  })

  it('sendNip17Chat stores an outgoing message then marks it sent', async () => {
    const api = new NostrAPI([])
    const publishSpy = jest
      .spyOn(api, 'publishEvent')
      .mockResolvedValue(undefined)

    await sendNip17Chat(api, sender, peerNpub, 'hello nip17')

    const stored = storedMessages()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      content: 'hello nip17',
      direction: 'out',
      peerPubkey,
      protocol: 'nip17',
      status: 'pending'
    })
    // Two publishes per NIP-17: recipient wrap + sender self copy.
    expect(publishSpy).toHaveBeenCalledTimes(2)
    expect(updateChatMessageStatus).toHaveBeenCalledWith(
      senderNpub,
      stored[0]?.id,
      'sent'
    )
  })

  it('sendNip17Chat seals one rumor tagged with the peer for both recipients', async () => {
    const api = new NostrAPI([])
    const published: Awaited<ReturnType<NDKEvent['toNostrEvent']>>[] = []
    jest.spyOn(api, 'publishEvent').mockImplementation(async (event) => {
      published.push(await event.toNostrEvent())
    })

    await sendNip17Chat(api, sender, peerNpub, 'same rumor')

    const [peerWrap, selfWrap] = published
    const peerRumor = unwrapPublished(peerWrap, peerSecretKey)
    const selfRumor = unwrapPublished(selfWrap, senderSecretKey)
    expect(selfRumor.id).toBe(peerRumor.id)
    expect(selfRumor.tags).toStrictEqual([['p', peerPubkey]])
    expect(storedMessages()[0]).toMatchObject({ id: peerRumor.id })
  })

  it('files a synced self copy under the peer thread, deduped by rumor id', async () => {
    const api = new NostrAPI([])
    const published: Awaited<ReturnType<NDKEvent['toNostrEvent']>>[] = []
    jest.spyOn(api, 'publishEvent').mockImplementation(async (event) => {
      published.push(await event.toNostrEvent())
    })
    await sendNip17Chat(api, sender, peerNpub, 'from my phone')
    const [, selfWrap] = published
    const selfRumor = unwrapPublished(selfWrap, senderSecretKey)
    chatStore.clear()

    const { api: otherDevice, captured } = createFakeChatApi()
    await subscribeToIdentityChat(otherDevice, sender)
    deliverRumor(captured.handlers, 'self-wrap', { ...selfRumor })
    deliverRumor(captured.handlers, 'self-wrap-redelivered', { ...selfRumor })

    expect(storedMessages()).toHaveLength(1)
    expect(storedMessages()[0]).toMatchObject({
      content: 'from my phone',
      direction: 'out',
      id: selfRumor.id,
      peerPubkey
    })
  })

  it('sendNip17Chat marks the message failed and rethrows the relay error', async () => {
    const api = new NostrAPI([])
    const relayError = new NostrNoRelaysError('no relays')
    jest.spyOn(api, 'publishEvent').mockRejectedValue(relayError)

    await expect(sendNip17Chat(api, sender, peerNpub, 'hello')).rejects.toBe(
      relayError
    )
    expect(updateChatMessageStatus).toHaveBeenCalledWith(
      senderNpub,
      expect.any(String),
      'failed'
    )
  })

  it('marks sent when base relays reject but the inbox copy lands', async () => {
    jest
      .spyOn(NostrAPI.prototype, 'fetchInboxRelaysForNpub')
      .mockResolvedValue(['wss://peer-inbox.relay'])
    // One prototype mock for all instances: the read-only base relay rejects
    // every write, while the background copy to the inbox relay lands.
    jest
      .spyOn(NostrAPI.prototype, 'publishEvent')
      .mockImplementation(
        async function publishExceptReadOnly(this: NostrAPI): Promise<void> {
          if (this.getRelays().includes('wss://read-only.relay')) {
            throw new Error('read-only')
          }
        }
      )

    const api = new NostrAPI(['wss://read-only.relay'])
    await sendNip17Chat(api, sender, peerNpub, 'hello via inbox')

    expect(updateChatMessageStatus).toHaveBeenCalledWith(
      senderNpub,
      expect.any(String),
      'sent'
    )
  })

  it('routes a wrap copy to announced inbox relays in the background', async () => {
    jest
      .spyOn(NostrAPI.prototype, 'fetchInboxRelaysForNpub')
      .mockResolvedValue(['wss://peer-inbox.relay'])
    const publishSpy = jest
      .spyOn(NostrAPI.prototype, 'publishEvent')
      .mockResolvedValue(undefined)

    const api = new NostrAPI(['wss://base.relay'])
    await sendNip17Chat(api, sender, peerNpub, 'background copy')
    await flushBackground()

    // recipient wrap + self copy on our relays + wrap copy on the inbox relay
    expect(publishSpy).toHaveBeenCalledTimes(3)
  })

  it('caches recipient relays so later sends skip the inbox lookup', async () => {
    const inboxSpy = jest
      .spyOn(NostrAPI.prototype, 'fetchInboxRelaysForNpub')
      .mockResolvedValue(['wss://peer-inbox.relay'])
    jest.spyOn(NostrAPI.prototype, 'publishEvent').mockResolvedValue(undefined)

    const api = new NostrAPI(['wss://base.relay'])
    await sendNip17Chat(api, sender, peerNpub, 'first')
    await flushBackground()
    await sendNip17Chat(api, sender, peerNpub, 'second')
    await flushBackground()

    expect(inboxSpy).toHaveBeenCalledTimes(1)
  })

  it('sendNip04Chat produces a kind-4 event decryptable by the recipient', async () => {
    const api = new NostrAPI([])
    const published: { event?: Awaited<ReturnType<NostrAPI['createKind4']>> } =
      {}
    jest.spyOn(api, 'publishEvent').mockImplementation(async (event) => {
      published.event = event
    })

    await sendNip04Chat(api, sender, peerNpub, 'secret 🔐')

    const raw = published.event?.toNostrEvent()
    expect(raw?.kind).toBe(4)
    expect(raw?.tags).toContainEqual(['p', peerPubkey])

    const decrypted = nip04Decrypt(
      peerSecretKey,
      String(raw?.pubkey),
      String(raw?.content)
    )
    expect(decrypted).toBe('secret 🔐')
  })

  it('dedupes relay redelivery and delivers one batch per flush', () => {
    const listener = jest.fn<undefined, [unknown[]]>()
    const remove = addChatListener(listener)

    const message = {
      content: 'hi',
      created_at: 1000,
      direction: 'in' as const,
      id: 'dup-id',
      identityNpub: senderNpub,
      peerPubkey,
      protocol: 'nip17' as const,
      read: false,
      status: 'sent' as const
    }
    ingestChatMessage(message)
    ingestChatMessage(message)
    ingestChatMessage({ ...message, id: 'other-id' })
    expect(listener).not.toHaveBeenCalled()
    flushChatMessages()

    expect(insertChatMessage).toHaveBeenCalledTimes(3)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]).toHaveLength(2)
    remove()
  })

  it('subscription ingests kind-14 chat rumors and ignores other wraps', async () => {
    const { api, captured } = createFakeChatApi()
    await subscribeToIdentityChat(api, sender)

    deliverRumor(captured.handlers, 'wrap-1', {
      content: 'hey there',
      created_at: 2000,
      id: 'rumor-1',
      pubkey: peerPubkey
    })
    // label-sync payload — not a chat rumor
    deliverRumor(captured.handlers, 'wrap-2', {
      content: '{}',
      id: 'sync-1',
      kind: 1,
      pubkey: peerPubkey
    })

    const stored = storedMessages()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      content: 'hey there',
      id: 'rumor-1',
      protocol: 'nip17'
    })
    // Both wraps are recorded so neither is decrypted again.
    expect(processedWraps).toStrictEqual(
      new Set([`chat:${senderNpub}|wrap-1`, `chat:${senderNpub}|wrap-2`])
    )
  })

  it('ingests NIP-17 self copies as outgoing messages for the tagged peer', async () => {
    const { api, captured } = createFakeChatApi()
    await subscribeToIdentityChat(api, sender)

    deliverRumor(captured.handlers, 'wrap-self-1', {
      content: 'sent from my other device',
      created_at: 3000,
      id: 'self-rumor-1',
      pubkey: senderPubkey,
      tags: [['p', peerPubkey]]
    })
    // Another client's self copy: a relay hint serialised as null and a
    // malformed tag must not hide the peer.
    deliverRumor(captured.handlers, 'wrap-self-2', {
      content: 'sent from another client',
      created_at: 3001,
      id: 'self-rumor-2',
      pubkey: senderPubkey,
      tags: [
        ['p', peerPubkey, null],
        ['subject', 5]
      ]
    })

    const stored = storedMessages()
    expect(stored).toHaveLength(2)
    expect(stored[0]).toMatchObject({
      content: 'sent from my other device',
      direction: 'out',
      peerPubkey,
      read: true
    })
    expect(stored[1]).toMatchObject({
      content: 'sent from another client',
      direction: 'out',
      peerPubkey
    })
  })

  it('ingests incoming chat rumors whose tags are malformed', async () => {
    const { api, captured } = createFakeChatApi()
    await subscribeToIdentityChat(api, sender)

    deliverRumor(captured.handlers, 'wrap-bad-tags', {
      content: 'hello despite bad tags',
      created_at: 4000,
      id: 'rumor-bad-tags',
      pubkey: peerPubkey,
      tags: [null]
    })

    expect(storedMessages()).toHaveLength(1)
    expect(storedMessages()[0]).toMatchObject({
      content: 'hello despite bad tags',
      direction: 'in',
      peerPubkey
    })
  })

  it('wraps NIP-17 content as UTF-8 without URI encoding', () => {
    const text = 'café 你好 🔐'
    const wrap = new NostrAPI([]).createKind1059(sender.nsec, peerNpub, text)
    const rumor = nip59.unwrapEvent(wrap.toNostrEvent(), peerSecretKey)

    expect(rumor.content).toBe(text)
  })

  describe('live window', () => {
    it('fetches a bounded recent window when nothing is stored', () => {
      expect(getChatLiveWindow(senderNpub, 'nip17')).toStrictEqual({
        limit: NOSTR_CHAT_INITIAL_HISTORY_LIMIT
      })
    })

    it('catches up from the newest stored message per protocol', () => {
      ingestChatMessage({
        content: 'kind 4',
        created_at: 50_000,
        direction: 'in',
        id: 'k4',
        identityNpub: senderNpub,
        peerPubkey,
        protocol: 'nip04',
        read: false,
        status: 'sent'
      })

      expect(getChatLiveWindow(senderNpub, 'nip04')).toStrictEqual({
        limit: NOSTR_CHAT_CATCH_UP_LIMIT,
        since: 50_000 - NOSTR_CHAT_KIND4_CLOCK_SKEW_SEC
      })
    })
  })

  describe('pipeline over the relay adapter', () => {
    it('reopening sends since = newest stored message and never decrypts a wrap twice', async () => {
      const subscriptions = captureNdkSubscriptions()
      const decryptSpy = jest.spyOn(nip44.v2, 'decrypt')
      const wrap = new NostrAPI([]).createKind1059(
        peerNsec,
        senderNpub,
        'decrypt me once'
      )

      const first = acquireChatPipeline(pipelineIdentity)
      await first.ready
      const [firstSub] = findGiftWrapSubscriptions(subscriptions)
      expect(firstSub?.filters[0]).toMatchObject({
        limit: NOSTR_CHAT_INITIAL_HISTORY_LIMIT
      })
      expect(firstSub?.filters[0]?.since).toBeUndefined()
      firstSub?.handlers.get('event')?.(wrap)
      expect(decryptSpy).toHaveBeenCalledTimes(2)
      const [message] = storedMessages()
      expect(message).toMatchObject({ content: 'decrypt me once' })
      first.release()

      const second = acquireChatPipeline(pipelineIdentity)
      await second.ready
      const [, secondSub] = findGiftWrapSubscriptions(subscriptions)
      expect(secondSub?.filters[0]).toMatchObject({
        limit: NOSTR_CHAT_CATCH_UP_LIMIT,
        since:
          Number(message?.created_at) - NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC
      })
      secondSub?.handlers.get('event')?.(wrap)

      expect(decryptSpy).toHaveBeenCalledTimes(2)
      expect(storedMessages()).toHaveLength(1)
      second.release()
    })

    it('skips stored kind-4 events before decrypting them', async () => {
      const subscriptions = captureNdkSubscriptions()
      const event = await new NostrAPI([]).createKind4(
        peerNsec,
        senderNpub,
        'kind 4 once'
      )
      const lease = acquireChatPipeline(pipelineIdentity)
      await lease.ready
      const kind4Sub = subscriptions.find(
        (sub) => sub.filters[0]?.kinds?.includes(4) === true
      )

      kind4Sub?.handlers.get('event')?.(event)
      await flushBackground()
      expect(storedMessages()[0]).toMatchObject({ content: 'kind 4 once' })
      expect(insertChatMessage).toHaveBeenCalledTimes(1)

      kind4Sub?.handlers.get('event')?.(event)
      await flushBackground()

      expect(insertChatMessage).toHaveBeenCalledTimes(1)
      lease.release()
    })
  })

  describe('pipeline ref counting', () => {
    beforeEach(() => {
      jest
        .spyOn(NostrAPI.prototype, 'subscribeToChatGiftWraps')
        .mockResolvedValue(undefined)
      jest
        .spyOn(NostrAPI.prototype, 'subscribeToKind4')
        .mockResolvedValue(undefined)
    })

    it('releasing a lease twice never drops another screen hold', async () => {
      const listScreen = acquireChatPipeline(pipelineIdentity)
      const threadScreen = acquireChatPipeline(pipelineIdentity)
      await listScreen.ready

      listScreen.release()
      listScreen.release()
      expect(getChatPipelineApi(senderNpub)).not.toBeNull()

      threadScreen.release()
      expect(getChatPipelineApi(senderNpub)).toBeNull()
    })

    it('does not leak the pipeline if released during acquire', async () => {
      const finish: { subscribe?: () => void } = {}
      jest
        .spyOn(NostrAPI.prototype, 'subscribeToChatGiftWraps')
        .mockImplementation(
          async () =>
            new Promise((resolve) => {
              finish.subscribe = () => {
                resolve(undefined)
              }
            })
        )
      const closeSpy = jest.spyOn(NostrAPI.prototype, 'closeAllSubscriptions')

      const lease = acquireChatPipeline(pipelineIdentity)
      lease.release()
      finish.subscribe?.()
      await lease.ready

      expect(getChatPipelineApi(senderNpub)).toBeNull()
      expect(getChatPipelineStatus(senderNpub).state).toBe('idle')
      expect(closeSpy).toHaveBeenCalledWith()
    })
  })

  describe('pipeline errors', () => {
    it('surfaces a subscribe failure and does not keep the pipeline live', async () => {
      const subscribeSpy = jest
        .spyOn(NostrAPI.prototype, 'subscribeToChatGiftWraps')
        .mockRejectedValue(new NostrNoRelaysError('offline'))
      jest
        .spyOn(NostrAPI.prototype, 'subscribeToKind4')
        .mockResolvedValue(undefined)

      const lease = acquireChatPipeline(pipelineIdentity)
      await lease.ready

      expect(getChatPipelineStatus(senderNpub)).toStrictEqual({
        errorCode: 'noRelays',
        state: 'error'
      })
      expect(getChatPipelineApi(senderNpub)).toBeNull()

      subscribeSpy.mockResolvedValue(undefined)
      await restartChatPipeline(senderNpub)

      expect(getChatPipelineStatus(senderNpub).state).toBe('live')
      expect(getChatPipelineApi(senderNpub)).not.toBeNull()
      lease.release()
    })
  })
})
