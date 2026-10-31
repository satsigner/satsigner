import NDK, {
  NDKEvent,
  type NostrEvent as NDKNostrEvent
} from '@nostr-dev-kit/ndk'
import { getPublicKey, nip59 } from 'nostr-tools'
import { z } from 'zod'

import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_CHAT_CATCH_UP_LIMIT,
  NOSTR_CHAT_HISTORY_PAGE_LIMIT,
  NOSTR_CHAT_INITIAL_HISTORY_LIMIT,
  NOSTR_CHAT_KIND4_CLOCK_SKEW_SEC,
  NOSTR_DEFAULT_FETCH_TIMEOUT_MS,
  NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC,
  NOSTR_HEX_PUBKEY_RE,
  NOSTR_PROFILE_CACHE_TTL_SECS,
  NOSTR_UI_FLUSH_INTERVAL_MS
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import {
  insertChatMessage,
  markChatThreadRead,
  updateChatMessageStatus
} from '@/db/mutations/nostrChat'
import { getCachedProfile } from '@/db/nostrCache'
import {
  chatProcessedScope,
  isNostrEventProcessed,
  markNostrEventsProcessed
} from '@/db/nostrProcessedEvents'
import {
  getNewestSentChatMessageCreatedAt,
  getOldestChatMessageCreatedAt,
  hasChatMessage,
  listChatConversations,
  listChatThread
} from '@/db/queries/nostrChat'
import { type AuthorDisplayInfo } from '@/hooks/useNostrMessage'
import { queryClient } from '@/lib/queryClient'
import { useNostrStore } from '@/store/nostr'
import { Colors } from '@/styles'
import {
  type NostrChatConversationItem,
  type NostrChatEventRef,
  type NostrChatGiftWrap,
  type NostrChatMessage,
  type NostrChatPipelineStatus,
  type NostrChatProtocol,
  type NostrChatThreadItem,
  type NostrDM,
  type NostrKind4ChatEvent,
  type NostrSubscriptionWindow
} from '@/types/models/Nostr'
import { NostrPublishError } from '@/utils/errors'
import { formatNpub } from '@/utils/format'
import {
  getPubKeyHexFromNpub,
  getSecretFromNsec,
  safeNpubEncode
} from '@/utils/nostr'
import { getNostrContactsRelays } from '@/utils/nostrContacts'
import { getNostrErrorCode } from '@/utils/nostrErrorMessage'
import { getNostrTagValue } from '@/utils/nostrEvent'
import { registerNostrLifecycleHandler } from '@/utils/nostrLifecycle'
import { isNonEmptyString } from '@/utils/string'

const NOSTR_CHAT_RUMOR_KIND = 14

/** Kind 14 (NIP-17 chat message) rumor fields the chat pipeline reads. */
const Nip17ChatRumorSchema = z.object({
  content: z.string(),
  created_at: z.number().optional(),
  id: z.string().min(1),
  kind: z.literal(NOSTR_CHAT_RUMOR_KIND),
  pubkey: z.string().min(1),
  tags: z.unknown().optional()
})

type Nip17ChatRumor = z.infer<typeof Nip17ChatRumorSchema>

type ChatIdentity = {
  npub: string
  nsec: string
  relays?: string[]
}

const nostrChatQueryKeys = {
  conversations: (identityNpub: string, protocol: NostrChatProtocol) => [
    'nostrChat',
    identityNpub,
    'conversations',
    protocol
  ],
  identity: (identityNpub: string) => ['nostrChat', identityNpub],
  profiles: (peersKey: string, relaysKey: string) => [
    'nostrChatProfiles',
    peersKey,
    relaysKey
  ],
  thread: (
    identityNpub: string,
    protocol: NostrChatProtocol,
    peerPubkey: string,
    limit: number
  ) => ['nostrChat', identityNpub, 'thread', protocol, peerPubkey, limit]
}

type ChatListener = (messages: NostrChatMessage[]) => void

const chatListeners = new Set<ChatListener>()
const pendingChatMessages: NostrChatMessage[] = []
const chatFlushTimer: { current: ReturnType<typeof setTimeout> | null } = {
  current: null
}

function addChatListener(listener: ChatListener): () => void {
  chatListeners.add(listener)
  return () => {
    chatListeners.delete(listener)
  }
}

function invalidateChatQueries(identityNpub: string): void {
  void queryClient.invalidateQueries({
    queryKey: nostrChatQueryKeys.identity(identityNpub)
  })
}

/**
 * Delivers buffered messages in one batch so a history replay of hundreds of
 * events reruns the conversation and thread queries once, not per message.
 */
function flushChatMessages(): void {
  if (chatFlushTimer.current) {
    clearTimeout(chatFlushTimer.current)
    chatFlushTimer.current = null
  }
  const batch = pendingChatMessages.splice(0)
  if (batch.length === 0) {
    return
  }
  for (const identityNpub of new Set(batch.map((m) => m.identityNpub))) {
    invalidateChatQueries(identityNpub)
  }
  for (const listener of chatListeners) {
    try {
      listener(batch)
    } catch {
      // A broken listener must not break ingest for everyone else.
    }
  }
}

function scheduleChatFlush(): void {
  if (chatFlushTimer.current) {
    return
  }
  chatFlushTimer.current = setTimeout(
    flushChatMessages,
    NOSTR_UI_FLUSH_INTERVAL_MS
  )
}

/** Persists and buffers for the UI; redelivery is deduped by INSERT OR IGNORE. */
function ingestChatMessage(message: NostrChatMessage): boolean {
  const inserted = insertChatMessage(message)
  if (inserted) {
    pendingChatMessages.push(message)
    scheduleChatFlush()
  }
  return inserted
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
      return [...new Set([...inbox, ...baseRelays])]
    }
  } catch {
    // Offline or no relay list published — base relays only.
  }
  return baseRelays
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
  rawEvent: NDKNostrEvent,
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
  wrapRaw: NDKNostrEvent
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

function nowInSeconds(): number {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

type PublishOutcome = { error?: unknown; ok: boolean }

async function publishWithOutcome(
  api: NostrAPI,
  event: NDKEvent
): Promise<PublishOutcome> {
  try {
    await api.publishEvent(event)
    return { ok: true }
  } catch (error) {
    return { error, ok: false }
  }
}

async function isPublished(outcome: Promise<PublishOutcome>): Promise<boolean> {
  const { ok } = await outcome
  return ok
}

function toGiftWrapNdkEvent(
  rumor: ReturnType<typeof nip59.createRumor>,
  senderSecretKey: Uint8Array,
  recipientPubkey: string
): NDKEvent {
  const seal = nip59.createSeal(rumor, senderSecretKey, recipientPubkey)
  return new NDKEvent(
    new NDK({ autoConnectUserRelays: false, enableOutboxModel: false }),
    nip59.createWrap(seal, recipientPubkey)
  )
}

/**
 * NIP-17 seals ONE rumor (p = peer) for every recipient, sender included.
 * The self copy therefore carries the peer and the same rumor id, so the
 * sender's other devices file it under the peer thread and both sides store
 * the message under one id. (nostr-tools' nip17.wrapManyEvents builds a
 * separate rumor per recipient, so it is not used.)
 */
function createNip17ChatWraps(
  senderSecretKey: Uint8Array,
  peerPubkey: string,
  text: string
) {
  const rumor = nip59.createRumor(
    { content: text, kind: NOSTR_CHAT_RUMOR_KIND, tags: [['p', peerPubkey]] },
    senderSecretKey
  )
  return {
    rumor,
    selfWrap: toGiftWrapNdkEvent(
      rumor,
      senderSecretKey,
      getPublicKey(senderSecretKey)
    ),
    wrap: toGiftWrapNdkEvent(rumor, senderSecretKey, peerPubkey)
  }
}

async function sendNip17Chat(
  api: NostrAPI,
  identity: ChatIdentity,
  peerNpub: string,
  text: string
): Promise<void> {
  const peerPubkey = getPubKeyHexFromNpub(peerNpub)
  if (peerPubkey === null) {
    throw new Error('Invalid peer npub')
  }
  const senderSecretKey = getSecretFromNsec(identity.nsec)
  if (!senderSecretKey) {
    throw new Error('Invalid identity nsec')
  }

  const { rumor, selfWrap, wrap } = createNip17ChatWraps(
    senderSecretKey,
    peerPubkey,
    text
  )

  const message: NostrChatMessage = {
    content: text,
    created_at: rumor.created_at,
    direction: 'out',
    id: rumor.id,
    identityNpub: identity.npub,
    peerPubkey,
    protocol: 'nip17',
    read: true,
    status: 'pending'
  }
  ingestChatMessage(message)
  flushChatMessages()

  const baseRelays = api.getRelays()
  const wrapRaw = await wrap.toNostrEvent()

  // Race our own relays against the recipient's announced inbox relays: the
  // first successful publish marks the message sent. Base sets made of
  // read-only indexing relays reject writes, so the inbox copy must count.
  const basePublish = publishWithOutcome(api, wrap)
  const inboxPublish = routeWrapToRecipientInbox(peerNpub, baseRelays, wrapRaw)
  // Losing the self copy only delays sync to our other devices.
  const selfPublish = publishWithOutcome(api, selfWrap)

  const delivered = await anySucceeded([isPublished(basePublish), inboxPublish])
  await selfPublish

  if (!delivered) {
    updateChatMessageStatus(identity.npub, message.id, 'failed')
    const { error } = await basePublish
    throw error instanceof Error ? error : new NostrPublishError([])
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
  if (peerPubkey === null) {
    throw new Error('Invalid peer npub')
  }

  const event = await api.createKind4(identity.nsec, peerNpub, text)
  const message: NostrChatMessage = {
    content: text,
    created_at: nowInSeconds(),
    direction: 'out',
    id: event.id ?? `pending-${Date.now()}`,
    identityNpub: identity.npub,
    peerPubkey,
    protocol: 'nip04',
    read: true,
    status: 'pending'
  }
  ingestChatMessage(message)
  flushChatMessages()

  try {
    await api.publishEvent(event)
    updateChatMessageStatus(identity.npub, message.id, 'sent')
  } catch (error) {
    updateChatMessageStatus(identity.npub, message.id, 'failed')
    throw error
  }
}

/**
 * Live subscription window. With history stored, it only catches up from the
 * newest relay-confirmed message (NIP-59 backdates wraps by up to two days,
 * so kind 1059 reaches back by that jitter). A first open fetches a bounded
 * recent window instead of the full history.
 */
function getChatLiveWindow(
  identityNpub: string,
  protocol: NostrChatProtocol
): NostrSubscriptionWindow {
  const newest = getNewestSentChatMessageCreatedAt(identityNpub, protocol)
  if (newest === null) {
    return { limit: NOSTR_CHAT_INITIAL_HISTORY_LIMIT }
  }
  const overlap =
    protocol === 'nip17'
      ? NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC
      : NOSTR_CHAT_KIND4_CLOCK_SKEW_SEC
  return {
    limit: NOSTR_CHAT_CATCH_UP_LIMIT,
    since: Math.max(0, newest - overlap)
  }
}

function getChatPeerFromRumor(
  rumor: Nip17ChatRumor,
  ownHex: string | null
): string | null {
  // Self copies (NIP-17 wraps to sender) carry the peer in the rumor's p
  // tag; everyone else's wraps are incoming from the rumor author.
  const peer =
    rumor.pubkey === ownHex ? getNostrTagValue(rumor.tags, 'p') : rumor.pubkey
  return peer !== undefined && NOSTR_HEX_PUBKEY_RE.test(peer) ? peer : null
}

/** Other gift wraps (account label sync etc.) are not chat and are ignored. */
function ingestChatRumor(
  identityNpub: string,
  ownHex: string | null,
  wrap: NostrChatGiftWrap
): void {
  const parsedRumor = Nip17ChatRumorSchema.safeParse(wrap.rumor)
  if (!parsedRumor.success) {
    return
  }
  const rumor = parsedRumor.data
  const peerPubkey = getChatPeerFromRumor(rumor, ownHex)
  if (peerPubkey === null) {
    return
  }
  const isSelfCopy = rumor.pubkey === ownHex
  ingestChatMessage({
    content: rumor.content,
    created_at: rumor.created_at ?? wrap.createdAt,
    direction: isSelfCopy ? 'out' : 'in',
    id: rumor.id,
    identityNpub,
    peerPubkey,
    protocol: 'nip17',
    read: isSelfCopy,
    status: 'sent'
  })
}

function ingestKind4ChatEvent(
  identityNpub: string,
  event: NostrKind4ChatEvent
): void {
  ingestChatMessage({
    content: event.content,
    created_at: event.createdAt,
    direction: event.direction,
    id: event.id,
    identityNpub,
    peerPubkey: event.peerPubkey,
    protocol: 'nip04',
    read: event.direction === 'out',
    status: 'sent'
  })
}

type ChatEventObserver = (event: NostrChatEventRef) => void

/**
 * Gift wraps are decrypted once per identity: the wrap id is recorded after
 * its rumor is stored (or found not to be a chat message, or undecryptable),
 * and checked before any later decryption.
 */
async function subscribeToChatGiftWraps(
  api: NostrAPI,
  identity: ChatIdentity,
  window: NostrSubscriptionWindow,
  observe?: ChatEventObserver
): Promise<void> {
  const scope = chatProcessedScope(identity.npub)
  const ownHex = getPubKeyHexFromNpub(identity.npub)
  await api.subscribeToChatGiftWraps(
    identity.nsec,
    identity.npub,
    {
      onWrap: (wrap) => {
        ingestChatRumor(identity.npub, ownHex, wrap)
        markNostrEventsProcessed(scope, [
          { createdAt: wrap.createdAt, id: wrap.id }
        ])
      },
      shouldUnwrap: (wrap) => {
        observe?.(wrap)
        return !isNostrEventProcessed(scope, wrap.id)
      }
    },
    window
  )
}

async function subscribeToKind4Chat(
  api: NostrAPI,
  identity: ChatIdentity,
  window: NostrSubscriptionWindow,
  observe?: ChatEventObserver
): Promise<void> {
  await api.subscribeToKind4(
    identity.nsec,
    identity.npub,
    (event) => {
      ingestKind4ChatEvent(identity.npub, event)
    },
    {
      ...window,
      shouldDecrypt: (event) => {
        observe?.(event)
        return !hasChatMessage(identity.npub, event.id)
      }
    }
  )
}

/** Opens both live DM subscriptions for an identity. Throws when relays fail. */
async function subscribeToIdentityChat(
  api: NostrAPI,
  identity: ChatIdentity
): Promise<void> {
  await Promise.all([
    subscribeToChatGiftWraps(
      api,
      identity,
      getChatLiveWindow(identity.npub, 'nip17')
    ),
    subscribeToKind4Chat(
      api,
      identity,
      getChatLiveWindow(identity.npub, 'nip04')
    )
  ])
}

type ChatHistoryCursor = { exhausted: boolean; until: number | null }

type ChatPipeline = {
  api: NostrAPI
  generation: number
  history: Record<NostrChatProtocol, ChatHistoryCursor>
  identity: ChatIdentity
  refs: number
  relays: string[]
  unregisterLifecycle: () => void
}

type ChatPipelineLease = {
  ready: Promise<void>
  release: () => void
}

const IDLE_CHAT_PIPELINE_STATUS: NostrChatPipelineStatus = { state: 'idle' }
const CONNECTING_CHAT_PIPELINE_STATUS: NostrChatPipelineStatus = {
  state: 'connecting'
}
const LIVE_CHAT_PIPELINE_STATUS: NostrChatPipelineStatus = { state: 'live' }

/**
 * Singleton chat pipeline. Only one identity holds live subscriptions at a
 * time — acquiring a different identity tears the previous one down first.
 */
const activeChatPipeline: { current: ChatPipeline | null } = { current: null }
const chatPipelineStatusByNpub = new Map<string, NostrChatPipelineStatus>()
const chatPipelineStatusListeners = new Set<() => void>()

/** kind 10050 announcements are once per app session per identity. */
const announcedDmInboxFor = new Set<string>()

function setChatPipelineStatus(
  npub: string,
  status: NostrChatPipelineStatus
): void {
  if (chatPipelineStatusByNpub.get(npub) === status) {
    return
  }
  chatPipelineStatusByNpub.set(npub, status)
  for (const listener of chatPipelineStatusListeners) {
    listener()
  }
}

/** Stable per state, as useSyncExternalStore requires. */
function getChatPipelineStatus(npub: string): NostrChatPipelineStatus {
  return chatPipelineStatusByNpub.get(npub) ?? IDLE_CHAT_PIPELINE_STATUS
}

function subscribeChatPipelineStatus(listener: () => void): () => void {
  chatPipelineStatusListeners.add(listener)
  return () => {
    chatPipelineStatusListeners.delete(listener)
  }
}

function isActivePipeline(pipeline: ChatPipeline): boolean {
  return activeChatPipeline.current === pipeline
}

/**
 * The warm pipeline API for the identity, if a screen holds it and it did
 * not fail. Reusing its relay connections avoids reconnecting per send.
 */
function getChatPipelineApi(npub: string): NostrAPI | null {
  const pipeline = activeChatPipeline.current
  if (!pipeline || pipeline.identity.npub !== npub) {
    return null
  }
  return getChatPipelineStatus(npub).state === 'error' ? null : pipeline.api
}

async function announceDmInboxRelays(pipeline: ChatPipeline): Promise<void> {
  const { identity } = pipeline
  if (announcedDmInboxFor.has(identity.npub)) {
    return
  }
  announcedDmInboxFor.add(identity.npub)
  try {
    // Senders route wraps to the relays we read from.
    await pipeline.api.publishDmInboxRelayList(identity.nsec, pipeline.relays)
  } catch {
    // Retried on the next start; reading works without the announcement.
    announcedDmInboxFor.delete(identity.npub)
  }
}

/**
 * (Re)opens the live subscriptions on a fresh API instance. A newer start,
 * a pause or a close bumps the generation, so a slow superseded start closes
 * only its own subscriptions.
 */
async function startChatPipeline(pipeline: ChatPipeline): Promise<void> {
  pipeline.generation += 1
  const { generation } = pipeline
  pipeline.api.closeAllSubscriptions()
  const api = new NostrAPI(pipeline.relays)
  pipeline.api = api
  setChatPipelineStatus(pipeline.identity.npub, CONNECTING_CHAT_PIPELINE_STATUS)

  const failure = await subscribeToIdentityChat(api, pipeline.identity).then(
    () => null,
    (error: unknown) => ({ error })
  )
  if (!isActivePipeline(pipeline) || pipeline.generation !== generation) {
    api.closeAllSubscriptions()
    return
  }
  if (failure) {
    api.closeAllSubscriptions()
    setChatPipelineStatus(pipeline.identity.npub, {
      errorCode: getNostrErrorCode(failure.error),
      state: 'error'
    })
    return
  }
  setChatPipelineStatus(pipeline.identity.npub, LIVE_CHAT_PIPELINE_STATUS)
  await announceDmInboxRelays(pipeline)
}

function pauseChatPipeline(pipeline: ChatPipeline): void {
  if (!isActivePipeline(pipeline)) {
    return
  }
  pipeline.generation += 1
  pipeline.api.closeAllSubscriptions()
}

function closeChatPipeline(pipeline: ChatPipeline): void {
  pipeline.generation += 1
  pipeline.api.closeAllSubscriptions()
  pipeline.unregisterLifecycle()
  if (isActivePipeline(pipeline)) {
    activeChatPipeline.current = null
  }
  setChatPipelineStatus(pipeline.identity.npub, IDLE_CHAT_PIPELINE_STATUS)
}

/** Tears down the active pipeline regardless of holders (logout, wipe, tests). */
function closeActiveChatPipeline(): void {
  if (activeChatPipeline.current) {
    closeChatPipeline(activeChatPipeline.current)
  }
}

function createChatPipeline(identity: ChatIdentity): ChatPipeline {
  const relays = getNostrContactsRelays(identity.relays)
  const pipeline: ChatPipeline = {
    api: new NostrAPI(relays),
    generation: 0,
    history: {
      nip04: { exhausted: false, until: null },
      nip17: { exhausted: false, until: null }
    },
    identity,
    refs: 0,
    relays,
    unregisterLifecycle: () => undefined
  }
  // Background closes the live REQs; foreground catches up from the newest
  // stored message instead of replaying history.
  pipeline.unregisterLifecycle = registerNostrLifecycleHandler({
    onActive: () => {
      if (isActivePipeline(pipeline)) {
        void startChatPipeline(pipeline)
      }
    },
    onBackground: () => {
      pauseChatPipeline(pipeline)
    }
  })
  return pipeline
}

function getOrCreateChatPipeline(identity: ChatIdentity): ChatPipeline {
  const { current } = activeChatPipeline
  if (current && current.identity.npub === identity.npub) {
    return current
  }
  if (current) {
    closeChatPipeline(current)
  }
  const pipeline = createChatPipeline(identity)
  activeChatPipeline.current = pipeline
  return pipeline
}

/**
 * Holds the identity's chat pipeline until the returned lease is released.
 * Release is idempotent and bound to the pipeline it acquired, so a screen
 * that loses focus mid-acquire can never release another screen's hold.
 * Acquiring a pipeline that failed retries it.
 */
function acquireChatPipeline(identity: ChatIdentity): ChatPipelineLease {
  const pipeline = getOrCreateChatPipeline(identity)
  pipeline.refs += 1
  const { state } = getChatPipelineStatus(identity.npub)
  const ready =
    pipeline.refs === 1 || state === 'error'
      ? startChatPipeline(pipeline)
      : Promise.resolve()
  const lease = { released: false }

  function release(): void {
    if (lease.released) {
      return
    }
    lease.released = true
    if (!isActivePipeline(pipeline)) {
      return
    }
    pipeline.refs -= 1
    if (pipeline.refs <= 0) {
      closeChatPipeline(pipeline)
    }
  }

  return { ready, release }
}

/** Retries the identity's held pipeline, e.g. from a "relays failed" banner. */
async function restartChatPipeline(npub: string): Promise<void> {
  const pipeline = activeChatPipeline.current
  if (!pipeline || pipeline.identity.npub !== npub) {
    return
  }
  await startChatPipeline(pipeline)
}

/**
 * One `until` page of older history. `complete` is true only after EOSE.
 * A timeout with no events is not "no more history".
 */
type ChatHistoryPage = {
  complete: boolean
  oldest: number | null
}

async function fetchChatHistoryPage(
  api: NostrAPI,
  identity: ChatIdentity,
  protocol: NostrChatProtocol,
  until: number
): Promise<ChatHistoryPage> {
  const seen: { oldest: number | null } = { oldest: null }
  function observe({ createdAt }: NostrChatEventRef): void {
    seen.oldest =
      seen.oldest === null ? createdAt : Math.min(seen.oldest, createdAt)
  }
  const subscribe =
    protocol === 'nip17' ? subscribeToChatGiftWraps : subscribeToKind4Chat
  const pageWindow: NostrSubscriptionWindow = {
    closeOnEose: true,
    limit: NOSTR_CHAT_HISTORY_PAGE_LIMIT,
    until
  }
  const page = { eose: false }
  const timer: { current?: ReturnType<typeof setTimeout> } = {}
  const answered = new Promise<void>((resolve) => {
    pageWindow.onEose = () => {
      page.eose = true
      resolve()
    }
    timer.current = setTimeout(resolve, NOSTR_DEFAULT_FETCH_TIMEOUT_MS)
  })

  try {
    await subscribe(api, identity, pageWindow, observe)
    await answered
  } finally {
    clearTimeout(timer.current)
  }
  return { complete: page.eose, oldest: seen.oldest }
}

/**
 * Pages older relay history through the held pipeline. NIP-59 wraps are
 * never newer than their rumor, so the oldest stored message is a safe
 * first `until` for both protocols.
 */
async function loadOlderChatHistory(
  identityNpub: string,
  protocol: NostrChatProtocol
): Promise<{ exhausted: boolean }> {
  const pipeline = activeChatPipeline.current
  if (!pipeline || pipeline.identity.npub !== identityNpub) {
    return { exhausted: false }
  }
  const cursor = pipeline.history[protocol]
  if (cursor.exhausted) {
    return { exhausted: true }
  }
  const until =
    cursor.until ??
    getOldestChatMessageCreatedAt(identityNpub, protocol) ??
    nowInSeconds()
  const { complete, oldest } = await fetchChatHistoryPage(
    pipeline.api,
    pipeline.identity,
    protocol,
    until
  )
  if (!complete) {
    return { exhausted: false }
  }
  cursor.exhausted = oldest === null
  cursor.until = oldest === null ? until : oldest - 1
  return { exhausted: cursor.exhausted }
}

function listChatConversationItems(
  identityNpub: string,
  protocol: NostrChatProtocol
): NostrChatConversationItem[] {
  return listChatConversations(identityNpub, protocol).map((conversation) => ({
    ...conversation,
    peerNpub: safeNpubEncode(conversation.peerPubkey)
  }))
}

type ChatThreadAuthors = { ownHex: string; ownNpub: string; peerNpub: string }

/** Adapts a stored chat message to the NostrDM shape the shared card expects. */
function toChatThreadItem(
  message: NostrChatMessage,
  authors: ChatThreadAuthors
): NostrChatThreadItem {
  const isOut = message.direction === 'out'
  const dm: NostrDM = {
    author: isOut ? authors.ownNpub : authors.peerNpub,
    content: {
      created_at: message.created_at,
      description: message.content,
      pubkey: isOut ? authors.ownHex : message.peerPubkey
    },
    created_at: message.created_at,
    description: message.content,
    event: '',
    id: message.id,
    label: 0,
    pending: message.status === 'pending',
    read: message.read
  }
  return { dm, failed: message.status === 'failed' }
}

/**
 * Loads a thread for display and marks its incoming messages read, since
 * this only runs while the thread is on screen.
 */
function loadChatThreadItems(
  identityNpub: string,
  protocol: NostrChatProtocol,
  peerPubkey: string,
  limit: number
): NostrChatThreadItem[] {
  if (markChatThreadRead(identityNpub, protocol, peerPubkey) > 0) {
    void queryClient.invalidateQueries({
      queryKey: nostrChatQueryKeys.conversations(identityNpub, protocol)
    })
  }
  const authors: ChatThreadAuthors = {
    ownHex: getPubKeyHexFromNpub(identityNpub) ?? '',
    ownNpub: identityNpub,
    peerNpub: safeNpubEncode(peerPubkey)
  }
  return listChatThread(identityNpub, protocol, peerPubkey, limit).map(
    (message) => toChatThreadItem(message, authors)
  )
}

type ChatThreadAuthorProfile = { displayName?: string; picture?: string }

/** Display info for the thread card, keyed by npub: us and the peer. */
function buildChatThreadAuthors({
  ownDisplayName,
  ownNpub,
  peerNpub,
  peerProfile
}: {
  ownDisplayName?: string
  ownNpub: string
  peerNpub: string
  peerProfile?: ChatThreadAuthorProfile
}): Map<string, AuthorDisplayInfo> {
  return new Map([
    [
      ownNpub,
      {
        color: Colors.white,
        displayName: ownDisplayName,
        npubShort: formatNpub(ownNpub)
      }
    ],
    [
      peerNpub,
      {
        color: Colors.gray[500],
        displayName: peerProfile?.displayName,
        npubShort: formatNpub(peerNpub),
        picture: peerProfile?.picture
      }
    ]
  ])
}

function hasProfileDisplay(npub: string): boolean {
  const profile = useNostrStore.getState().profiles[npub]
  return (
    isNonEmptyString(profile?.displayName) || isNonEmptyString(profile?.picture)
  )
}

/**
 * Cache-first kind 0 load for DM peers into the shared nostr store: fresh
 * SQLite-cached profiles apply immediately and only the rest hit relays.
 * Throws when relays returned nothing so the query retries once.
 */
async function loadChatPeerProfiles(
  identityRelays: string[] | undefined,
  peerNpubs: string[]
): Promise<number> {
  const { setProfile } = useNostrStore.getState()
  const now = nowInSeconds()
  const relayHexes: string[] = []
  for (const npub of peerNpubs.filter((peer) => !hasProfileDisplay(peer))) {
    const hex = getPubKeyHexFromNpub(npub)
    const cached = hex !== null ? getCachedProfile(hex) : null
    if (cached && now - cached.cached_at < NOSTR_PROFILE_CACHE_TTL_SECS) {
      setProfile(npub, {
        displayName: cached.displayName,
        picture: cached.picture
      })
    } else if (hex !== null) {
      relayHexes.push(hex)
    }
  }
  if (relayHexes.length === 0) {
    return 0
  }
  const batch = await new NostrAPI(
    getNostrContactsRelays(identityRelays)
  ).fetchKind0Batch(relayHexes)
  for (const [hex, profile] of batch) {
    setProfile(safeNpubEncode(hex), {
      displayName: profile.displayName,
      picture: profile.picture
    })
  }
  if (batch.size === 0) {
    throw new Error('No peer profiles returned')
  }
  return batch.size
}

export {
  acquireChatPipeline,
  addChatListener,
  buildChatThreadAuthors,
  clearRecipientRelaysCache,
  closeActiveChatPipeline,
  flushChatMessages,
  getChatLiveWindow,
  getChatPipelineApi,
  getChatPipelineStatus,
  ingestChatMessage,
  invalidateChatQueries,
  listChatConversationItems,
  loadChatPeerProfiles,
  loadChatThreadItems,
  loadOlderChatHistory,
  nostrChatQueryKeys,
  restartChatPipeline,
  sendNip04Chat,
  sendNip17Chat,
  subscribeChatPipelineStatus,
  subscribeToIdentityChat
}
export type { ChatIdentity, ChatPipelineLease }
