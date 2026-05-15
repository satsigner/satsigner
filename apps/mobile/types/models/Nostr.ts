import { z } from 'zod'

import { NostrAPI } from '@/api/nostr'
import { type Account } from '@/types/models/Account'

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

export const Nip46ConnectionStatusSchema = z.enum([
  'connected',
  'connecting',
  'disconnected',
  'error',
  'relays_unreachable'
])

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
  read: z.boolean().optional()
})

export const NostrAccountSchema = z.object({
  autoSync: z.boolean(),
  commonNpub: z.string(),
  commonNsec: z.string(),
  deviceDisplayName: z.string().optional(),
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
  pubkey: z.string().optional()
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
  provider: NostrVideoProviderSchema,
  thumbnailUrl: z.string().optional(),
  watchUrl: z.string()
})

export const NostrUnwrappedEventSchema = z.object({
  content: z.string(),
  created_at: z.number().optional(),
  id: z.string(),
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

export type Nip46ConnectionStatus = z.infer<typeof Nip46ConnectionStatusSchema>
export type Nip46Method = z.infer<typeof Nip46MethodSchema>
export type Nip46ParsedUri = z.infer<typeof Nip46ParsedUriSchema>
export type Nip46PermissionPolicy = z.infer<typeof Nip46PermissionPolicySchema>
export type Nip46Request = z.infer<typeof Nip46RequestSchema>
export type Nip46Session = z.infer<typeof Nip46SessionSchema>
export type NostrAccount = z.infer<typeof NostrAccountSchema>
export type NostrContentKind = z.infer<typeof NostrContentKindSchema>
export type NostrDecodedContent = z.infer<typeof NostrDecodedContentSchema>
export type NostrDerivedKeys = z.infer<typeof NostrDerivedKeysSchema>
export type NostrDM = z.infer<typeof NostrDMSchema>
export type NostrEnhancedZapTags = z.infer<typeof NostrEnhancedZapTagsSchema>
export type NostrFetchedNoteData = z.infer<typeof NostrFetchedNoteDataSchema>
export type NostrIdentity = z.infer<typeof NostrIdentitySchema>
export type NostrKeys = z.infer<typeof NostrKeysSchema>
export type NostrKind0Profile = z.infer<typeof NostrKind0ProfileSchema>
export type NostrMessageData = z.infer<typeof NostrMessageDataSchema>
export type NostrMessage = z.infer<typeof NostrMessageSchema>
export type NostrPendingDM = z.infer<typeof NostrPendingDMSchema>
export type NostrRelayConnectionDetail = z.infer<
  typeof NostrRelayConnectionDetailSchema
>
export type NostrRelayConnectionInfo = z.infer<
  typeof NostrRelayConnectionInfoSchema
>
export type NostrRelayDisconnectReason = z.infer<
  typeof NostrRelayDisconnectReasonSchema
>
export type NostrRelayReachability = z.infer<
  typeof NostrRelayReachabilitySchema
>
export type NostrRelay = z.infer<typeof NostrRelaySchema>
export type NostrSyncStatusEvent = z.infer<typeof NostrSyncStatusEventSchema>
export type NostrSyncStatus = z.infer<typeof NostrSyncStatusSchema>
export type NostrUnwrappedEvent = z.infer<typeof NostrUnwrappedEventSchema>
export type NostrVideoEmbed = z.infer<typeof NostrVideoEmbedSchema>
export type NostrVideoProvider = z.infer<typeof NostrVideoProviderSchema>
export type NostrZapPreferences = z.infer<typeof NostrZapPreferencesSchema>

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
