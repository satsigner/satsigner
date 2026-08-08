import { NostrAPI } from '@/api/nostr'
import {
  insertChatMessage,
  updateChatMessageStatus
} from '@/db/mutations/nostrChat'
import { type NostrChatMessage } from '@/types/models/Nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { getNostrContactsRelays } from '@/utils/nostrContacts'

type ChatListener = (message: NostrChatMessage) => void

const chatListeners = new Set<ChatListener>()

function addChatListener(listener: ChatListener): () => void {
  chatListeners.add(listener)
  return () => {
    chatListeners.delete(listener)
  }
}

function emitChatMessage(message: NostrChatMessage): void {
  for (const listener of chatListeners) {
    try {
      listener(message)
    } catch {
      // A broken listener must not break ingest for everyone else.
    }
  }
}

function chatLog(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log('[nostrChat]', ...args)
}

/** Persists and broadcasts; relay redelivery is deduped by INSERT OR IGNORE. */
function ingestChatMessage(message: NostrChatMessage): void {
  const inserted = insertChatMessage(message)
  if (inserted) {
    chatLog('ingested', message.protocol, message.direction, message.id)
    emitChatMessage(message)
  }
}

type ChatIdentity = {
  npub: string
  nsec: string
  relays?: string[]
}

async function sendNip17Chat(
  api: NostrAPI,
  identity: ChatIdentity,
  peerNpub: string,
  text: string
): Promise<void> {
  const peerPubkey = getPubKeyHexFromNpub(peerNpub)
  if (!peerPubkey) {
    throw new Error('Invalid peer npub')
  }

  const wrap = api.createKind1059(identity.nsec, peerNpub, text)
  const message: NostrChatMessage = {
    content: text,
    created_at: Math.floor(Date.now() / 1000),
    direction: 'out',
    id: wrap.id ?? `pending-${Date.now()}`,
    identityNpub: identity.npub,
    peerPubkey,
    protocol: 'nip17',
    read: true,
    status: 'pending'
  }
  ingestChatMessage(message)

  try {
    await api.publishEvent(wrap)
    updateChatMessageStatus(identity.npub, message.id, 'sent')
  } catch (error) {
    updateChatMessageStatus(identity.npub, message.id, 'failed')
    throw error
  }
}

async function sendNip04Chat(
  api: NostrAPI,
  identity: ChatIdentity,
  peerNpub: string,
  text: string
): Promise<void> {
  const peerPubkey = getPubKeyHexFromNpub(peerNpub)
  if (!peerPubkey) {
    throw new Error('Invalid peer npub')
  }

  const event = await api.createKind4(identity.nsec, peerNpub, text)
  const message: NostrChatMessage = {
    content: text,
    created_at: Math.floor(Date.now() / 1000),
    direction: 'out',
    id: event.id ?? `pending-${Date.now()}`,
    identityNpub: identity.npub,
    peerPubkey,
    protocol: 'nip04',
    read: true,
    status: 'pending'
  }
  ingestChatMessage(message)

  try {
    await api.publishEvent(event)
    updateChatMessageStatus(identity.npub, message.id, 'sent')
  } catch (error) {
    updateChatMessageStatus(identity.npub, message.id, 'failed')
    throw error
  }
}

type Nip17Rumor = {
  content?: unknown
  created_at?: number
  id?: string
  kind?: number
  pubkey?: string
}

/**
 * Singleton chat pipeline per identity. Chat screens acquire/release; only
 * one identity holds live subscriptions at a time — acquiring a different
 * identity tears the previous one down first, so switching accounts always
 * produces a clean, fresh subscription set.
 */
let activeChatPipeline: { api: NostrAPI; npub: string; refs: number } | null =
  null

async function acquireChatPipeline(identity: ChatIdentity): Promise<NostrAPI> {
  if (activeChatPipeline && activeChatPipeline.npub !== identity.npub) {
    chatLog('identity switched, closing previous pipeline', {
      from: activeChatPipeline.npub.slice(0, 16),
      to: identity.npub.slice(0, 16)
    })
    activeChatPipeline.api.closeAllSubscriptions()
    activeChatPipeline = null
  }

  if (!activeChatPipeline) {
    const relays = getNostrContactsRelays(identity.relays)
    const api = new NostrAPI(relays)
    activeChatPipeline = { api, npub: identity.npub, refs: 0 }
    await subscribeToIdentityChat(api, identity).catch((error) => {
      chatLog('subscription failed', error)
    })
  }
  activeChatPipeline.refs += 1
  return activeChatPipeline.api
}

function releaseChatPipeline(npub: string): void {
  if (!activeChatPipeline || activeChatPipeline.npub !== npub) {
    return
  }
  activeChatPipeline.refs -= 1
  if (activeChatPipeline.refs <= 0) {
    chatLog('closing pipeline', npub.slice(0, 16))
    activeChatPipeline.api.closeAllSubscriptions()
    activeChatPipeline = null
  }
}

/**
 * Opens both DM subscriptions for an identity and ingests incoming messages
 * into the chat store. NIP-17 chat rumors are kind 14; other gift wraps
 * (account label sync etc.) target different keys and are ignored here.
 */
async function subscribeToIdentityChat(
  api: NostrAPI,
  identity: ChatIdentity
): Promise<void> {
  chatLog('subscribing', identity.npub.slice(0, 16), 'relays:', api.getRelays())

  await api.subscribeToKind1059(identity.nsec, identity.npub, (messages) => {
    chatLog('gift wraps in batch:', messages.length)
    for (const message of messages) {
      const rumor = message.content as Nip17Rumor
      if (
        rumor?.kind !== 14 ||
        typeof rumor.content !== 'string' ||
        !rumor.id ||
        !rumor.pubkey ||
        rumor.pubkey === getPubKeyHexFromNpub(identity.npub)
      ) {
        chatLog(
          'skipped wrap (not a chat rumor):',
          `kind=${rumor?.kind}`,
          `hasContent=${typeof rumor?.content === 'string'}`
        )
        continue
      }
      ingestChatMessage({
        content: rumor.content,
        created_at: rumor.created_at ?? message.created_at ?? 0,
        direction: 'in',
        id: rumor.id,
        identityNpub: identity.npub,
        peerPubkey: rumor.pubkey,
        protocol: 'nip17',
        read: false,
        status: 'sent'
      })
    }
  })

  await api.subscribeToKind4(
    identity.nsec,
    identity.npub,
    (message) => {
      if (message.direction === 'out') {
        // Own sends are already stored optimistically with the same event id.
        return
      }
      ingestChatMessage({
        content: message.content,
        created_at: message.createdAt,
        direction: 'in',
        id: message.id,
        identityNpub: identity.npub,
        peerPubkey: message.peerPubkey,
        protocol: 'nip04',
        read: false,
        status: 'sent'
      })
    },
    undefined
  )
}

export {
  acquireChatPipeline,
  addChatListener,
  ingestChatMessage,
  releaseChatPipeline,
  sendNip04Chat,
  sendNip17Chat,
  subscribeToIdentityChat
}
