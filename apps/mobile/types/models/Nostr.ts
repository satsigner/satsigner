import { z } from 'zod'

import type { NostrAPI } from '@/api/nostr'
import {
  NOSTR_CHAT_AGENT_AMOUNT_MAX_SATS,
  NOSTR_CHAT_AGENT_COST_MAX_SATS,
  NOSTR_CHAT_AGENT_DURATION_MAX_MS,
  NOSTR_CHAT_AGENT_ID_MAX,
  NOSTR_CHAT_AGENT_MODELS_MAX,
  NOSTR_CHAT_AGENT_NAME_MAX,
  NOSTR_CHAT_AGENT_REQUESTS_MAX,
  NOSTR_CHAT_AGENT_SCHEMA_VERSION,
  NOSTR_CHAT_AGENT_THINKING_MAX,
  NOSTR_CHAT_AGENT_TOKENS_MAX,
  NOSTR_CHAT_AGENT_UNIT
} from '@/constants/nostr'
import type { Account } from '@/types/models/Account'

// ─── Schemas ────────────────────────────────────────────────────────────────

export const NostrFetchedNoteDataSchema = z.object({
  authorLud16: z.string().optional(),
  authorName: z.string().optional(),
  authorNip05: z.string().optional(),
  authorPicture: z.string().optional(),
  content: z.string(),
  created_at: z.number(),
  kind: z.number(),
  pubkey: z.string(),
  tags: z.array(z.array(z.string()))
})

export const NostrContentKindSchema = z.enum([
  'json_note',
  'nevent',
  'note',
  'nprofile',
  'npub',
  'unknown'
])

export const NostrDecodedContentSchema = z.object({
  data: z.string(),
  fetched: NostrFetchedNoteDataSchema.optional(),
  isLoading: z.boolean().optional(),
  kind: NostrContentKindSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  raw: z.string()
})

export const NostrDerivedKeysSchema = z.object({
  mnemonic: z.string(),
  npub: z.string(),
  nsec: z.string(),
  privateKey: z.instanceof(Uint8Array)
})

export const NostrRelayDisconnectReasonSchema = z.enum([
  'all_failed',
  'no_internet',
  'no_relays',
  'user_disabled'
])

export const NostrEnhancedZapTagsSchema = z.object({
  zapGoal: z.number().optional(),
  zapLnurl: z.string().optional(),
  zapMax: z.number().optional(),
  zapMin: z.number().optional(),
  zapPayer: z.string().optional(),
  zapUses: z.number().optional()
})

export type NostrSignedKind1Event = {
  content: string
  created_at: number
  id: string
  kind: number
  pubkey: string
  sig: string
  tags: string[][]
}

export type NostrUnwrappedKind1059Event = {
  id: string
  content: string
  pubkey: string
  created_at?: number
}

export const Nip46ConnectionStatusSchema = z.enum([
  'connected',
  'connecting',
  'disconnected',
  'error',
  'relays_unreachable'
])

export type Nip46IncomingRequest = {
  id: string
  method: string
  params: string[]
}

export const Nip46MethodSchema = z.enum([
  'connect',
  'get_public_key',
  'nip04_decrypt',
  'nip04_encrypt',
  'nip44_decrypt',
  'nip44_encrypt',
  'ping',
  'sign_event'
])

export const Nip46ParsedUriSchema = z.object({
  clientPubkey: z.string(),
  name: z.string().optional(),
  perms: z.string().optional(),
  relays: z.array(z.string()),
  secret: z.string().optional()
})

export const Nip46PermissionPolicySchema = z.enum([
  'always_allow',
  'always_reject',
  'ask'
])

export const Nip46RequestSchema = z.object({
  id: z.string(),
  method: Nip46MethodSchema,
  params: z.array(z.string()),
  receivedAt: z.number(),
  sessionId: z.string(),
  status: z.enum(['approved', 'pending', 'rejected'])
})

export const Nip46SessionSchema = z.object({
  clientName: z.string().optional(),
  clientPubkey: z.string(),
  connectionError: z.string().optional(),
  connectionStatus: Nip46ConnectionStatusSchema.optional(),
  createdAt: z.number(),
  id: z.string(),
  lastActiveAt: z.number(),
  permissions: z.record(Nip46MethodSchema, Nip46PermissionPolicySchema),
  relays: z.array(z.string()),
  secret: z.string().optional(),
  signerNpub: z.string()
})

export const NostrDMSchema = z.object({
  author: z.string(),
  content: z.object({
    created_at: z.number(),
    description: z.string(),
    pubkey: z.string().optional()
  }),
  created_at: z.number(),
  description: z.string(),
  event: z.string(),
  id: z.string(),
  label: z.number(),
  pending: z.boolean().optional(),
  read: z.boolean().optional(),
  replyToId: z.string().optional()
})

export const NostrAccountSchema = z.object({
  autoSync: z.boolean(),
  commonNpub: z.string(),
  commonNsec: z.string(),
  deviceDisplayName: z.string().optional(),
  deviceMnemonic: z.string().optional(),
  deviceNpub: z.string().optional(),
  deviceNsec: z.string().optional(),
  devicePicture: z.string().optional(),
  dms: z.array(NostrDMSchema),
  lastBackupFingerprint: z.string().optional(),
  lastUpdated: z.date(),
  npubAliases: z.record(z.string(), z.string()).optional(),
  npubProfiles: z
    .record(
      z.string(),
      z.object({
        displayName: z.string().optional(),
        picture: z.string().optional()
      })
    )
    .optional(),
  relayStatuses: z
    .record(z.string(), z.enum(['connected', 'connecting', 'disconnected']))
    .optional(),
  relays: z.array(z.string()),
  syncStart: z.date(),
  trustedMemberDevices: z.array(z.string())
})

export const NostrZapPreferencesSchema = z.object({
  autoApprove: z.boolean(),
  autoApproveWalletId: z.string().optional(),
  oneTapAmount: z.number(),
  presetAmounts: z.array(z.number())
})

export const NostrIdentitySchema = z.object({
  banner: z.string().optional(),
  blossomServers: z.array(z.string()).optional(),
  createdAt: z.number(),
  displayName: z.string().optional(),
  isWatchOnly: z.boolean(),
  lud16: z.string().optional(),
  mnemonic: z.string().optional(),
  nip05: z.string().optional(),
  npub: z.string(),
  nsec: z.string().optional(),
  picture: z.string().optional(),
  /** When true, the app may query relays for this identity. Omitted or false means disconnected. */
  relayConnected: z.boolean().optional(),
  relays: z.array(z.string()).optional(),
  zapPreferences: NostrZapPreferencesSchema.optional()
})

export const NostrKeysSchema = z.object({
  npub: z.string(),
  nsec: z.string(),
  secretNostrKey: z.instanceof(Uint8Array)
})

export const NostrKind0ProfileSchema = z.object({
  banner: z.string().optional(),
  displayName: z.string().optional(),
  lud16: z.string().optional(),
  nip05: z.string().optional(),
  picture: z.string().optional()
})

export const NostrContactItemSchema = z.object({
  profile: NostrKind0ProfileSchema.nullable(),
  pubkey: z.string()
})

export const NostrMessageDataSchema = z.object({
  data: z.unknown().optional(),
  data_type: z.enum(['LabelsBip329', 'PSBT', 'SignMessageRequest', 'Tx'])
})

export const NostrMessageSchema = z.object({
  content: z.union([z.string(), z.record(z.string(), z.unknown())]),
  created_at: z.number(),
  decryptedContent: z.string().optional(),
  id: z.string(),
  isSender: z.boolean().optional(),
  pubkey: z.string().optional(),
  /** Id of the NIP-59 gift wrap that carried this rumor. */
  wrapId: z.string().optional()
})

export const NostrRelayReachabilitySchema = z.enum([
  'checking',
  'connected',
  'disconnected'
])

export const NostrRelaySchema = z.object({
  name: z.string(),
  url: z.string()
})

export const NostrRelayConnectionDetailSchema = z.object({
  connected: z.boolean(),
  error: z.string().optional(),
  url: z.string()
})

export const NostrRelayConnectionInfoSchema = z.object({
  reason: NostrRelayDisconnectReasonSchema.optional(),
  relayDetails: z.array(NostrRelayConnectionDetailSchema).optional(),
  status: NostrRelayReachabilitySchema
})

export const NostrSyncStatusSchema = z.enum([
  'connecting',
  'error',
  'idle',
  'syncing'
])

export const NostrSyncStatusEventSchema = z.object({
  accountId: z.string(),
  lastError: z.string().optional(),
  messagesProcessed: z.number().optional(),
  messagesReceived: z.number().optional(),
  status: NostrSyncStatusSchema
})

export const NostrVideoProviderSchema = z.enum([
  'direct',
  'twitch_clip',
  'twitch_vod',
  'vimeo',
  'youtube'
])

export const NostrVideoEmbedSchema = z.object({
  aspectRatio: z.number().positive().optional(),
  provider: NostrVideoProviderSchema,
  thumbnailUrl: z.string().optional(),
  watchUrl: z.string()
})

export const NostrUnwrappedEventSchema = z.object({
  content: z.string(),
  created_at: z.number().optional(),
  id: z.string(),
  kind: z.number().optional(),
  pubkey: z.string(),
  tags: z.array(z.array(z.unknown())).optional()
})

export const NostrPendingDMSchema = z.object({
  eventContent: z.record(z.string(), z.unknown()),
  /** Set to true when the handler already showed its own toast (e.g. PSBT).
   *  storeBatch will skip the generic "New Device Message" toast. */
  skipToast: z.boolean().optional(),
  unwrappedEvent: NostrUnwrappedEventSchema
})

// ─── Types ───────────────────────────────────────────────────────────────────

export type Nip46Method = z.infer<typeof Nip46MethodSchema>
export type Nip46ParsedUri = z.infer<typeof Nip46ParsedUriSchema>
export type Nip46PermissionPolicy = z.infer<typeof Nip46PermissionPolicySchema>
export type Nip46Request = z.infer<typeof Nip46RequestSchema>
export type Nip46Session = z.infer<typeof Nip46SessionSchema>
export type NostrAccount = z.infer<typeof NostrAccountSchema>
export type NostrDecodedContent = z.infer<typeof NostrDecodedContentSchema>
export type NostrDerivedKeys = z.infer<typeof NostrDerivedKeysSchema>
export type NostrDM = z.infer<typeof NostrDMSchema>
export type NostrEnhancedZapTags = z.infer<typeof NostrEnhancedZapTagsSchema>
export type NostrFetchedNoteData = z.infer<typeof NostrFetchedNoteDataSchema>
export type NostrIdentity = z.infer<typeof NostrIdentitySchema>
export type NostrKeys = z.infer<typeof NostrKeysSchema>
export type NostrKind0Profile = z.infer<typeof NostrKind0ProfileSchema>
export type NostrZapPreferences = z.infer<typeof NostrZapPreferencesSchema>
export type NostrContactItem = z.infer<typeof NostrContactItemSchema>
export type NostrMessageData = z.infer<typeof NostrMessageDataSchema>
export type NostrMessage = z.infer<typeof NostrMessageSchema>
export type NostrPendingDM = z.infer<typeof NostrPendingDMSchema>
export type NostrRelayConnectionInfo = z.infer<
  typeof NostrRelayConnectionInfoSchema
>
export type NostrRelay = z.infer<typeof NostrRelaySchema>
export type NostrSyncStatusEvent = z.infer<typeof NostrSyncStatusEventSchema>
export type NostrSyncStatus = z.infer<typeof NostrSyncStatusSchema>
export type NostrUnwrappedEvent = z.infer<typeof NostrUnwrappedEventSchema>
export type NostrVideoEmbed = z.infer<typeof NostrVideoEmbedSchema>

// The following types reference class instances or function signatures that
// cannot be represented as Zod schemas because they would cause cyclic imports.
// TODO: remove Account from MessageHandler

export type NostrMsgHandler = {
  canHandle: (context: NostrMsgHandlerContext) => boolean
  handle: (context: NostrMsgHandlerContext) => void | Promise<void>
}

export type NostrMsgHandlerContext = {
  account: Account
  data?: NostrMessageData
  eventContent: Record<string, unknown>
  lastDataExchangeEOSE: number
  onPendingDM: (dm: NostrPendingDM) => void
  syncStartSec: number
  unwrappedEvent: NostrUnwrappedEvent
}

export type NostrSubscriptionHandle = {
  accountId: string
  dataExchangeApi: NostrAPI | null
  protocolApi: NostrAPI | null
}

// TODO: reorganize this file, which keeps growing as refactoring goes.

export type NostrNoteKindFilterOption = {
  id: string
  kinds: number[]
  labelKey: string
}

export type NostrBookmarkSource = 'public' | 'private'

export type NostrContactQrSlide = {
  key: string
  kind: 'placeholder' | 'qr'
  label: string
  value?: string
}

export type NostrParsedBookmark = {
  eventId: string
  source: NostrBookmarkSource
}

export type NostrKind1DraftImport = {
  content: string
  tags: string[][]
}

export type NostrFeedNoteLike = {
  id: string
  content: string
  pubkey: string
  kind: number
  tags: string[][]
  created_at: number
}

export type NostrEngagementEvent = {
  content: string
  created_at: number
  id: string
  kind: number
  pubkey: string
  targetId: string
}

export type NostrReactionEvent = NostrEngagementEvent & {
  tags: string[][]
}

export type NostrReactionsPage = {
  /** Events the relays returned before filtering; drives pagination. */
  fetchedCount: number
  oldestCreatedAt: number | null
  reactions: NostrReactionEvent[]
}

export type NostrReaction =
  | { key: string; type: 'like' }
  | { key: string; type: 'dislike' }
  | { content: string; key: string; type: 'emoji' }
  | { key: string; shortcode: string; type: 'customEmoji'; url: string }

export type NostrReactionItem = {
  authorPubkey: string
  createdAt: number
  id: string
  reaction: NostrReaction
}

export type NostrReactionRow = NostrReactionItem & {
  authorLabel: string
  authorNpub: string
  authorPicture?: string
}

export type NostrReactionSummaryEntry = {
  count: number
  reaction: NostrReaction
}

export type NostrEngagementDeletion = {
  pubkey: string
  tags: string[][]
}

export type NostrEngagementSigner = {
  isWatchOnly: boolean
  nsec?: string
  ownPubkey: string
}

export type NostrNoteEngagement = {
  likeCount: number
  ownLikeIds: string[]
  ownRepostIds: string[]
  repostCount: number
}

export type NostrPollOption = {
  id: string
  label: string
}

export type NostrPollType = 'singlechoice' | 'multiplechoice'

export type NostrPollInfo = {
  endsAt?: number
  options: NostrPollOption[]
  pollType: NostrPollType
  relays: string[]
}

export type NostrPollResponse = {
  created_at: number
  id: string
  optionIds: string[]
  pubkey: string
}

export type NostrRetryConfig = {
  baseDelayMs: number
  jitterFactor: number
  maxDelayMs: number
  maxRetries: number
}

export type NostrRetryManagerHandle = {
  cancel: (key: string) => void
  getAttemptCount: (key: string) => number
  isMaxRetriesReached: (key: string) => boolean
  isPending: (key: string) => boolean
  reset: (key: string) => void
  resetAll: () => void
  scheduleRetry: (
    key: string,
    callback: () => void
  ) => { scheduled: boolean; delay: number }
}

// Zap

export type ZapFlowParams = {
  recipientLud16: string
  recipientPubkeyHex: string
  senderNsec: string
  eventIdHex?: string
  eventKind?: number
  eventTags?: string[][]
  amountSats: number
  comment?: string
  relays: string[]
}

export type ZapFlowResult = {
  invoice: string
  zapRequestJson: string
}

export type ZapSortField = 'date' | 'amount'

export type ZapReceiptDirection = 'incoming' | 'outgoing'

export type ZapReceiptInfo = {
  id: string
  senderPubkey: string
  senderLud16?: string
  senderName?: string
  senderNip05?: string
  senderPicture?: string
  recipientLud16?: string
  recipientPubkey?: string
  recipientName?: string
  recipientNip05?: string
  recipientPicture?: string
  direction: ZapReceiptDirection
  amountSats: number
  comment?: string
  createdAt: number
  /** First `e` tag on the receipt: zapped note or other referenced event. */
  zappedEventId?: string
  /** Full kind-9735 event JSON (when fetched from relays in this session). */
  rawEventJson?: string
}

export const NostrChatProtocolSchema = z.enum(['nip04', 'nip17'])

/** A bad field is dropped instead of the whole document. */
function lenient<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined)
}

const agentId = z.string().min(1).max(NOSTR_CHAT_AGENT_ID_MAX)
const agentName = z.string().min(1).max(NOSTR_CHAT_AGENT_NAME_MAX)
const agentThinkingLevel = z.string().min(1).max(NOSTR_CHAT_AGENT_THINKING_MAX)
const agentTokenCount = z
  .number()
  .int()
  .nonnegative()
  .max(NOSTR_CHAT_AGENT_TOKENS_MAX)
const agentSats = z.number().nonnegative().max(NOSTR_CHAT_AGENT_AMOUNT_MAX_SATS)
const agentVersion = z.literal(NOSTR_CHAT_AGENT_SCHEMA_VERSION)
const agentUnit = z.literal(NOSTR_CHAT_AGENT_UNIT)

const NostrChatAgentTokensSchema = z.object({
  cacheRead: lenient(agentTokenCount),
  cacheWrite: lenient(agentTokenCount),
  input: lenient(agentTokenCount),
  output: lenient(agentTokenCount)
})

/** `agent_cost` tag on an agent's reply: what that answer cost, in sats. */
export const NostrChatAgentCostSchema = z.object({
  amount: z.number().nonnegative().max(NOSTR_CHAT_AGENT_COST_MAX_SATS),
  durationMs: lenient(
    z.number().int().nonnegative().max(NOSTR_CHAT_AGENT_DURATION_MAX_MS)
  ),
  models: lenient(z.array(agentId).max(NOSTR_CHAT_AGENT_MODELS_MAX)),
  /** Some requests could not be priced: `amount` is a lower bound. */
  partial: lenient(z.literal(true)),
  requests: z.number().int().min(1).max(NOSTR_CHAT_AGENT_REQUESTS_MAX),
  tokens: lenient(NostrChatAgentTokensSchema),
  unit: agentUnit,
  v: agentVersion
})

/** `agent_model` tag on an agent's reply: the model that wrote it. */
export const NostrChatAgentModelSchema = z.object({
  id: agentId,
  name: lenient(agentName),
  provider: agentId,
  thinkingLevel: lenient(agentThinkingLevel),
  used: lenient(z.array(agentId).max(NOSTR_CHAT_AGENT_MODELS_MAX)),
  v: agentVersion
})

const NostrChatSessionStateModelSchema = z.object({
  id: agentId,
  name: lenient(agentName),
  provider: agentId,
  reasoning: lenient(z.boolean()),
  vision: lenient(z.boolean())
})

/**
 * The agent's session state document (kind 30078, `d` nip17-session-state):
 * what the agent runs on and what the session has cost. `agent` is the same
 * in every session, `session` belongs to the one the document names.
 */
export const NostrChatSessionStateSchema = z.object({
  agent: lenient(
    z.object({
      balance: lenient(
        z.object({
          apiKeys: lenient(agentSats),
          low: lenient(z.boolean()),
          unit: agentUnit,
          wallet: lenient(agentSats)
        })
      ),
      name: lenient(agentName),
      provider: lenient(agentId)
    })
  ),
  session: lenient(
    z.object({
      busy: lenient(z.boolean()),
      cacheHitRate: lenient(z.number().min(0).max(1)),
      context: lenient(
        z.object({
          autoCompact: lenient(z.boolean()),
          tokens: lenient(agentTokenCount),
          window: lenient(agentTokenCount.positive())
        })
      ),
      model: lenient(NostrChatSessionStateModelSchema),
      /** One model setting serves every session of this agent. */
      sharedModel: lenient(z.boolean()),
      spent: lenient(
        z.object({
          amount: agentSats,
          partial: lenient(z.literal(true)),
          unit: agentUnit
        })
      ),
      thinkingLevel: lenient(agentThinkingLevel),
      tokens: lenient(NostrChatAgentTokensSchema)
    })
  ),
  v: agentVersion
})

export type NostrChatAgentCost = z.infer<typeof NostrChatAgentCostSchema>
export type NostrChatAgentModel = z.infer<typeof NostrChatAgentModelSchema>
export type NostrChatAgentTokens = z.infer<typeof NostrChatAgentTokensSchema>
export type NostrChatSessionState = z.infer<typeof NostrChatSessionStateSchema>

/** Newest session state document the peer sent for one session. */
export type NostrChatStoredSessionState = {
  state: NostrChatSessionState
  /** Rumor created_at, unix seconds. */
  updatedAt: number
}

export const NostrChatMessageSchema = z.object({
  agentCost: NostrChatAgentCostSchema.optional(),
  agentModel: NostrChatAgentModelSchema.optional(),
  content: z.string(),
  created_at: z.number(),
  direction: z.enum(['in', 'out']),
  id: z.string(),
  identityNpub: z.string(),
  peerPubkey: z.string(),
  protocol: NostrChatProtocolSchema,
  read: z.boolean(),
  replyToId: z.string().optional(),
  /** NIP-17 session with this peer; '' is the default (untagged) one. */
  sessionId: z.string(),
  status: z.enum(['pending', 'sent', 'failed'])
})

/** A NIP-25 reaction (kind 7 rumor) to a NIP-17 chat message. */
export type NostrChatReaction = {
  /** Reaction rumor id, named by a later kind 5 that removes it. */
  id: string
  identityNpub: string
  messageId: string
  /** Hex pubkey of whoever reacted. */
  author: string
  emoji: string
  created_at: number
}

/** Reactions on one message, grouped by emoji. */
export type NostrChatReactionSummary = {
  emoji: string
  count: number
  /** Ids of my reactions with this emoji (from any of my devices), to remove them. */
  ownReactionIds: string[]
}

export type NostrChatProtocol = z.infer<typeof NostrChatProtocolSchema>
export type NostrChatMessage = z.infer<typeof NostrChatMessageSchema>

/** Names one thread: a session with a peer, over one protocol. */
export type NostrChatThreadRef = Pick<
  NostrChatMessage,
  'identityNpub' | 'peerPubkey' | 'protocol' | 'sessionId'
>

/** One NIP-17 session with a peer, as kept in nostr_chat_sessions. */
export type NostrChatSession = Pick<
  NostrChatMessage,
  'identityNpub' | 'peerPubkey' | 'sessionId'
> & {
  archived: boolean
  createdAt: number
  title?: string
  /** The user set or cleared the title; a peer's subject no longer applies. */
  titleLocked?: boolean
}

export type NostrChatConversation = Pick<
  NostrChatMessage,
  'peerPubkey' | 'sessionId'
> & {
  lastMessageAt: number
  lastMessagePreview: string
  title?: string
  unreadCount: number
}

export type NostrChatConversationItem = NostrChatConversation & {
  peerNpub: string
}

export type NostrChatPipelineStatus = {
  errorCode?: NostrErrorCode
  state: 'connecting' | 'error' | 'idle' | 'live'
}

export type NostrSubscriptionWindow = {
  closeOnEose?: boolean
  limit?: number
  onEose?: () => void
  since?: number
  until?: number
}

export type NostrKind4ChatEvent = {
  content: string
  createdAt: number
  direction: 'in' | 'out'
  id: string
  peerPubkey: string
  /** NIP-13 difficulty the event committed to and met. */
  pow: number
}

export type NostrChatEventRef = {
  createdAt: number
  id: string
}

export type NostrChatGiftWrap = NostrChatEventRef & {
  /** NIP-13 difficulty the wrap committed to and met. */
  pow: number
  rumor: NostrUnwrappedKind1059Event | null
}

export type NostrChatThreadItem = {
  /** What the peer's agent reported for this reply; only on its messages. */
  agent?: Pick<NostrChatMessage, 'agentCost' | 'agentModel'>
  dm: NostrDM
  failed: boolean
  reactions: NostrChatReaction[]
}

export type NostrErrorCode =
  | 'noRelays'
  | 'partialSend'
  | 'publishFailed'
  | 'timeout'
  | 'unknown'

/** Where fetched data came from: live relays, the local cache, or an expired cache entry. */
export type NostrDataSource = 'cache' | 'relay' | 'stale'

export type NostrFetchResult<T> = {
  data: T
  error?: NostrErrorCode
  source: NostrDataSource
}

export type NostrFollowList = {
  connectedRelayCount: number
  kind3Found: boolean
  pubkeys: string[]
  relaysQueried: string[]
}

export type NostrNotesQuery = {
  kinds?: number[]
  limit?: number
  /** Only notes newer than this (exclusive of the cached head). */
  since?: number
  until?: number
}
