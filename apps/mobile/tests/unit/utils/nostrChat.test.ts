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
      insertChatMessage: jest.fn((message: { id: string }) => {
        if (store.has(message.id)) {
          return false
        }
        store.set(message.id, message)
        return true
      }),
      updateChatMessageStatus: jest.fn()
    }
  }
)

import { getPublicKey, nip19, nip59 } from 'nostr-tools'
import { decrypt as nip04Decrypt } from 'nostr-tools/nip04'

import { NostrAPI } from '@/api/nostr'
import {
  __store as chatStore,
  insertChatMessage,
  updateChatMessageStatus
} from '@/db/mutations/nostrChat'
import {
  acquireChatPipeline,
  addChatListener,
  clearRecipientRelaysCache,
  getChatPipelineApi,
  ingestChatMessage,
  releaseChatPipeline,
  sendNip04Chat,
  sendNip17Chat,
  subscribeToIdentityChat
} from '@/utils/nostrChat'

const senderSecretKey = new Uint8Array(32).fill(1)
const senderPubkey = getPublicKey(senderSecretKey)
const senderNpub = nip19.npubEncode(senderPubkey)
const senderNsec = nip19.nsecEncode(senderSecretKey)

const peerSecretKey = new Uint8Array(32).fill(2)
const peerPubkey = getPublicKey(peerSecretKey)
const peerNpub = nip19.npubEncode(peerPubkey)

const sender = { npub: senderNpub, nsec: senderNsec }

/** Lets the background inbox-routing promise chain settle. */
async function flushBackground() {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
  }
}

describe('nostrChat', () => {
  beforeEach(() => {
    chatStore.clear()
    clearRecipientRelaysCache()
    jest.clearAllMocks()
    // No recipient inbox relays in tests — skip the indexing-relay lookup.
    jest
      .spyOn(NostrAPI.prototype, 'fetchInboxRelaysForNpub')
      .mockResolvedValue([])
    releaseChatPipeline(senderNpub)
  })

  it('sendNip17Chat stores an outgoing message then marks it sent', async () => {
    const api = new NostrAPI([])
    const publishSpy = jest
      .spyOn(api, 'publishEvent')
      .mockResolvedValue(undefined)

    await sendNip17Chat(api, sender, peerNpub, 'hello nip17')

    const stored = [...chatStore.values()] as {
      content: string
      direction: string
      peerPubkey: string
      protocol: string
      status: string
    }[]
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
      stored[0] && (stored[0] as { id: string }).id,
      'sent'
    )
  })

  it('sendNip17Chat marks the message failed when all publishes fail', async () => {
    const api = new NostrAPI([])
    jest.spyOn(api, 'publishEvent').mockRejectedValue(new Error('no relays'))

    await expect(sendNip17Chat(api, sender, peerNpub, 'hello')).rejects.toThrow(
      'Failed to publish to any relay'
    )
    expect(updateChatMessageStatus).toHaveBeenCalledWith(
      senderNpub,
      expect.any(String),
      'failed'
    )
  })

  it('marks sent when base relays reject but the inbox copy lands', async () => {
    // Recipient announces an inbox relay; our base set is a read-only relay.
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
    let published: Awaited<ReturnType<NostrAPI['createKind4']>> | null = null
    jest.spyOn(api, 'publishEvent').mockImplementation(async (event) => {
      published = event
    })

    await sendNip04Chat(api, sender, peerNpub, 'secret 🔐')

    expect(published).not.toBeNull()
    const raw = published!.toNostrEvent()
    expect(raw.kind).toBe(4)
    expect(raw.tags).toContainEqual(['p', peerPubkey])

    const decrypted = await nip04Decrypt(peerSecretKey, raw.pubkey, raw.content)
    expect(decrypted).toBe('secret 🔐')
  })

  it('dedupes relay redelivery by message id', () => {
    const listener = jest.fn()
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

    expect(insertChatMessage).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenCalledTimes(1)
    remove()
  })

  it('subscription ingests kind-14 chat rumors and ignores other wraps', async () => {
    let rumorCallback:
      | ((messages: { content: unknown; created_at: number }[]) => void)
      | undefined
    const fakeApi = {
      getRelays: () => ['wss://test.relay'],
      subscribeToKind1059: jest.fn(
        async (
          _nsec: string,
          _npub: string,
          cb: (messages: { content: unknown; created_at: number }[]) => void
        ) => {
          rumorCallback = cb
        }
      ),
      subscribeToKind4: jest.fn(async () => undefined)
    }

    await subscribeToIdentityChat(fakeApi as unknown as NostrAPI, sender)
    expect(rumorCallback).toBeDefined()

    rumorCallback!([
      {
        content: {
          content: 'hey there',
          created_at: 2000,
          id: 'rumor-1',
          kind: 14,
          pubkey: peerPubkey
        },
        created_at: 2000,
        id: 'wrap-1',
        pubkey: 'wrap-author'
      },
      {
        // label-sync payload — not a chat rumor
        content: { content: '{}', id: 'sync-1', kind: 1, pubkey: peerPubkey },
        created_at: 2001,
        id: 'wrap-2',
        pubkey: 'wrap-author'
      }
    ])

    const stored = [...chatStore.values()] as {
      content: string
      id: string
      protocol: string
    }[]
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      content: 'hey there',
      id: 'rumor-1',
      protocol: 'nip17'
    })
  })

  it('ingests NIP-17 self copies as outgoing messages for the tagged peer', async () => {
    let rumorCallback:
      | ((messages: { content: unknown; created_at: number }[]) => void)
      | undefined
    const fakeApi = {
      getRelays: () => ['wss://test.relay'],
      subscribeToKind1059: jest.fn(
        async (
          _nsec: string,
          _npub: string,
          cb: (messages: { content: unknown; created_at: number }[]) => void
        ) => {
          rumorCallback = cb
        }
      ),
      subscribeToKind4: jest.fn(async () => undefined)
    }

    await subscribeToIdentityChat(fakeApi as unknown as NostrAPI, sender)

    rumorCallback!([
      {
        // Our own self copy: rumor author is us, peer lives in the p tag.
        content: {
          content: 'sent from my other device',
          created_at: 3000,
          id: 'self-rumor-1',
          kind: 14,
          pubkey: senderPubkey,
          tags: [['p', peerPubkey]]
        },
        created_at: 3000,
        id: 'wrap-self-1',
        pubkey: 'wrap-author'
      }
    ])

    const stored = [...chatStore.values()] as Record<string, unknown>[]
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      content: 'sent from my other device',
      direction: 'out',
      peerPubkey,
      read: true
    })
  })

  it('wraps NIP-17 content as UTF-8 without URI encoding', () => {
    const text = 'café 你好 🔐'
    const wrap = new NostrAPI([]).createKind1059(sender.nsec, peerNpub, text)
    const rumor = nip59.unwrapEvent(wrap.toNostrEvent(), peerSecretKey)

    expect(rumor.content).toBe(text)
  })

  it('does not leak the chat pipeline if released during acquire', async () => {
    let finishSubscribe: (() => void) | undefined
    jest.spyOn(NostrAPI.prototype, 'subscribeToKind1059').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSubscribe = () => resolve(undefined)
        })
    )
    jest
      .spyOn(NostrAPI.prototype, 'subscribeToKind4')
      .mockResolvedValue(undefined)
    jest
      .spyOn(NostrAPI.prototype, 'publishDmInboxRelayList')
      .mockResolvedValue(undefined)

    const pending = acquireChatPipeline({
      npub: senderNpub,
      nsec: senderNsec,
      relays: ['wss://test.relay']
    })
    releaseChatPipeline(senderNpub)
    finishSubscribe?.()
    await pending

    expect(getChatPipelineApi(senderNpub)).toBeNull()
  })
})
