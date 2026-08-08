// Real nostr-tools for genuine NIP-04/NIP-17 crypto; NDK stays mocked (the
// manual mock preserves event fields) so no sockets are opened.
jest.mock('nostr-tools', () => jest.requireActual('nostr-tools'))
jest.mock('@nostr-dev-kit/ndk')

// In-memory chat message store — precise insert/dedup behavior without SQLite.
jest.mock('@/db/mutations/nostrChat', () => {
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
})

import { getPublicKey, nip19 } from 'nostr-tools'
import { decrypt as nip04Decrypt } from 'nostr-tools/nip04'

import { NostrAPI } from '@/api/nostr'
import {
  __store as chatStore,
  insertChatMessage,
  updateChatMessageStatus
} from '@/db/mutations/nostrChat'
import {
  addChatListener,
  ingestChatMessage,
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

beforeEach(() => {
  chatStore.clear()
  jest.clearAllMocks()
  // No recipient inbox relays in tests — skip the indexing-relay lookup.
  jest
    .spyOn(NostrAPI.prototype, 'fetchInboxRelaysForNpub')
    .mockResolvedValue([])
})

describe('nostrChat', () => {
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
    expect(publishSpy).toHaveBeenCalledTimes(1)
    expect(updateChatMessageStatus).toHaveBeenCalledWith(
      senderNpub,
      stored[0] && (stored[0] as { id: string }).id,
      'sent'
    )
  })

  it('sendNip17Chat marks the message failed when publish rejects', async () => {
    const api = new NostrAPI([])
    jest.spyOn(api, 'publishEvent').mockRejectedValue(new Error('no relays'))

    await expect(
      sendNip17Chat(api, sender, peerNpub, 'hello')
    ).rejects.toThrow('no relays')
    expect(updateChatMessageStatus).toHaveBeenCalledWith(
      senderNpub,
      expect.any(String),
      'failed'
    )
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
})
