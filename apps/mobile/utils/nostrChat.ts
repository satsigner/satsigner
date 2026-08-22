import NDK, { NDKEvent } from '@nostr-dev-kit/ndk'
import { type Event, nip59 } from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import {
  insertChatMessage,
  updateChatMessageStatus
} from '@/db/mutations/nostrChat'
import { type NostrChatMessage } from '@/types/models/Nostr'
import { getPubKeyHexFromNpub, getSecretFromNsec } from '@/utils/nostr'
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

/**
 * Resolves where to publish a DM for a recipient: their announced inbox
 * relays (kind 10050 / 10002, looked up on the indexing relays) unioned with
 * the caller's base set. Falls back to the base set when the recipient never
 * announced or the lookup fails.
 */
export async function resolveRecipientRelays(
  recipientNpub: string,
  baseRelays: string[]
): Promise<string[]> {
  try {
    const lookup = new NostrAPI(NostrAPI.INDEXING_RELAYS)
    const inbox = await lookup.fetchInboxRelaysForNpub(recipientNpub)
    lookup.closeAllSubscriptions()
    if (inbox.length > 0) {
      chatLog('recipient inbox relays:', inbox)
      return [...new Set([...inbox, ...baseRelays])]
    }
  } catch {
    // Offline or no relay list published — base relays only.
  }
  return baseRelays
}

/** Persists and broadcasts; relay redelivery is deduped by INSERT OR IGNORE. */
function ingestChatMessage(message: NostrChatMessage): void {
  const inserted = insertChatMessage(message)
  if (inserted) {
    chatLog('ingested', message.protocol, message.direction, message.id)
    emitChatMessage(message)
  }
}

/**
 * Session cache of recipient relay unions (base ∪ announced inbox) so repeat
 * sends skip the indexing-relay lookup entirely.
 */
const recipientRelaysCache = new Map<string, string[]>()

/** Test hook: drops cached recipient relay lookups between tests. */
function clearRecipientRelaysCache(): void {
  recipientRelaysCache.clear()
}

/**
 * Publishes an already-signed event to extra relays without blocking the
 * sender's flow. Resolves true when at least one relay accepted the event.
 */
async function publishEventToRelaysInBackground(
  rawEvent: Event,
  relayUrls: string[]
): Promise<boolean> {
  if (relayUrls.length === 0) {
    return false
  }
  const api = new NostrAPI(relayUrls)
  try {
    const event = new NDKEvent(
      new NDK({ autoConnectUserRelays: false, enableOutboxModel: false }),
      rawEvent
    )
    await api.publishEvent(event)
    return true
  } catch {
    // Best-effort copy; relay failures must not affect the sender's flow.
    return false
  } finally {
    api.closeAllSubscriptions()
  }
}

/**
 * Routes a copy of the wrap toward the recipient's announced inbox relays.
 * Results are cached per session so repeat sends skip the lookup. Resolves
 * true when the wrap reached at least one inbox-only relay.
 */
async function routeWrapToRecipientInbox(
  peerNpub: string,
  baseRelays: string[],
  wrapRaw: Event
): Promise<boolean> {
  try {
    const cached = recipientRelaysCache.get(peerNpub)
    const relays =
      cached ?? (await resolveRecipientRelays(peerNpub, baseRelays))
    if (!cached) {
      recipientRelaysCache.set(peerNpub, relays)
    }
    return await publishEventToRelaysInBackground(
      wrapRaw,
      relays.filter((url) => !baseRelays.includes(url))
    )
  } catch {
    // Offline or unreachable inbox relays — the base publish may still land.
    return false
  }
}

/**
 * Resolves true as soon as any task succeeds; false only when every task
 * failed. Lets a fast base-relay publish win while still falling back to
 * slower inbox-relay delivery when base relays reject writes.
 */
async function anySucceeded(tasks: Promise<boolean>[]): Promise<boolean> {
  try {
    await Promise.any(
      tasks.map(async (task) => {
        if (!(await task)) {
          throw new Error('publish failed')
        }
      })
    )
    return true
  } catch {
    return false
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
  const senderSecretKey = getSecretFromNsec(identity.nsec)
  if (!senderSecretKey) {
    throw new Error('Invalid identity nsec')
  }

  // NIP-17: gift-wrap to the recipient AND to ourselves — the self copy is
  // what lets sent messages sync to other devices and reload from relays.
  const wrap = api.createKind1059(identity.nsec, peerNpub, text)
  const selfWrap = api.createKind1059(identity.nsec, identity.npub, text)

  // Store under the rumor id (deterministic) so the relay echo of our self
  // copy dedups via INSERT OR IGNORE instead of duplicating.
  const selfWrapRaw = await selfWrap.toNostrEvent()
  const rumorId = nip59.unwrapEvent(selfWrapRaw as Event, senderSecretKey).id

  const message: NostrChatMessage = {
    content: text,
    created_at: Math.floor(Date.now() / 1000),
    direction: 'out',
    id: rumorId,
    identityNpub: identity.npub,
    peerPubkey,
    protocol: 'nip17',
    read: true,
    status: 'pending'
  }
  ingestChatMessage(message)

  const baseRelays = api.getRelays()
  const wrapRaw = (await wrap.toNostrEvent()) as Event

  // Race our own relays against the recipient's announced inbox relays: the
  // first successful publish marks the message sent. Base sets made of
  // read-only indexing relays reject writes, so the inbox copy must count.
  const basePublish = (async () => {
    try {
      await api.publishEvent(wrap)
      return true
    } catch {
      return false
    }
  })()
  const inboxPublish = routeWrapToRecipientInbox(peerNpub, baseRelays, wrapRaw)
  // Self copy goes to our own read relays (the pipeline's set); best effort.
  const selfPublish = (async () => {
    try {
      await api.publishEvent(selfWrap)
    } catch {
      // Losing the self copy only delays sync to our other devices.
    }
  })()

  const delivered = await anySucceeded([basePublish, inboxPublish])
  await selfPublish

  if (!delivered) {
    updateChatMessageStatus(identity.npub, message.id, 'failed')
    throw new Error('Failed to publish to any relay')
  }
  updateChatMessageStatus(identity.npub, message.id, 'sent')
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

/**
 * The warm pipeline API for the currently active identity, if any screen
 * holds it. Reusing its live relay connections avoids reconnecting per send.
 */
function getChatPipelineApi(npub: string): NostrAPI | null {
  return activeChatPipeline?.npub === npub ? activeChatPipeline.api : null
}

/** kind 10050 announcements are once per app session per identity. */
const announcedDmInboxFor = new Set<string>()

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
    chatLog(
      'pipeline relays resolved:',
      identity.relays?.length
        ? `identity-pinned (${relays.length})`
        : `indexer-default (${relays.length})`,
      relays.join(' ')
    )
    const api = new NostrAPI(relays)
    activeChatPipeline = { api, npub: identity.npub, refs: 0 }
    await subscribeToIdentityChat(api, identity).catch((error) => {
      chatLog('subscription failed', error)
    })
    // Announce our DM inbox relays so senders route wraps where we read them.
    if (!announcedDmInboxFor.has(identity.npub)) {
      announcedDmInboxFor.add(identity.npub)
      try {
        await api.publishDmInboxRelayList(identity.nsec, relays)
        chatLog('announced DM inbox relays:', relays.join(' '))
      } catch (error) {
        chatLog('DM inbox announce failed', error)
      }
    }
  }
  activeChatPipeline.refs += 1
  chatLog(
    'pipeline acquired',
    identity.npub.slice(0, 16),
    `refs=${activeChatPipeline.refs}`
  )
  return activeChatPipeline.api
}

function releaseChatPipeline(npub: string): void {
  if (!activeChatPipeline || activeChatPipeline.npub !== npub) {
    return
  }
  activeChatPipeline.refs -= 1
  chatLog(
    'pipeline released',
    npub.slice(0, 16),
    `refs=${activeChatPipeline.refs}`
  )
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

  const ownHex = getPubKeyHexFromNpub(identity.npub)

  await api.subscribeToKind1059(identity.nsec, identity.npub, (messages) => {
    chatLog('gift wraps in batch:', messages.length)
    for (const message of messages) {
      const rumor = message.content as Nip17Rumor
      if (
        rumor?.kind !== 14 ||
        typeof rumor.content !== 'string' ||
        !rumor.id ||
        !rumor.pubkey
      ) {
        chatLog(
          'skipped wrap (not a chat rumor):',
          `kind=${rumor?.kind}`,
          `hasContent=${typeof rumor?.content === 'string'}`
        )
        continue
      }

      // Self copies (NIP-17 wraps to sender) carry the peer in the rumor's
      // p tag; everyone else's wraps are incoming from the rumor author.
      const isSelfCopy = rumor.pubkey === ownHex
      const rumorTags = (rumor as { tags?: string[][] }).tags ?? []
      const peerFromTag = rumorTags.find((tag) => tag[0] === 'p')?.[1]
      const peerPubkey = isSelfCopy ? peerFromTag : rumor.pubkey
      if (!peerPubkey || !/^[0-9a-f]{64}$/.test(peerPubkey)) {
        chatLog('skipped wrap: no valid peer pubkey')
        continue
      }

      ingestChatMessage({
        content: rumor.content,
        created_at: rumor.created_at ?? message.created_at ?? 0,
        direction: isSelfCopy ? 'out' : 'in',
        id: rumor.id,
        identityNpub: identity.npub,
        peerPubkey,
        protocol: 'nip17',
        read: isSelfCopy,
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
  clearRecipientRelaysCache,
  getChatPipelineApi,
  ingestChatMessage,
  releaseChatPipeline,
  sendNip04Chat,
  sendNip17Chat,
  subscribeToIdentityChat
}
