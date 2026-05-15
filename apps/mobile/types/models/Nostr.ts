import { z } from 'zod'

import { NostrAPI } from '@/api/nostr'

import type { Account } from './Account'

export const NostrMessageSchema = z.object({
  content: z.union([z.string(), z.record(z.string(), z.unknown())]),
  created_at: z.number(),
  decryptedContent: z.string().optional(),
  id: z.string(),
  isSender: z.boolean().optional(),
  pubkey: z.string().optional()
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

export const NostrKind0ProfileSchema = z.object({
  banner: z.string().optional(),
  displayName: z.string().optional(),
  lud16: z.string().optional(),
  nip05: z.string().optional(),
  picture: z.string().optional()
})

export const NostrKeysSchema = z.object({
  npub: z.string(),
  nsec: z.string(),
  secretNostrKey: z.instanceof(Uint8Array)
})

export const NostrRelaySchema = z.object({
  name: z.string(),
  url: z.string()
})

export type NostrMessage = z.infer<typeof NostrMessageSchema>
export type NostrDM = z.infer<typeof NostrDMSchema>
export type NostrAccount = z.infer<typeof NostrAccountSchema>
export type NostrKind0Profile = z.infer<typeof NostrKind0ProfileSchema>
export type NostrKeys = z.infer<typeof NostrKeysSchema>
export type NostrRelay = z.infer<typeof NostrRelaySchema>

export type Nip46ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'relays_unreachable'
  | 'error'
  | 'disconnected'

export type Nip46Method =
  | 'connect'
  | 'get_public_key'
  | 'nip04_decrypt'
  | 'nip04_encrypt'
  | 'nip44_decrypt'
  | 'nip44_encrypt'
  | 'ping'
  | 'sign_event'

export type Nip46PermissionPolicy = 'always_allow' | 'always_reject' | 'ask'

export type Nip46Session = {
  clientName?: string
  clientPubkey: string
  connectionError?: string
  connectionStatus?: Nip46ConnectionStatus
  createdAt: number
  id: string
  lastActiveAt: number
  permissions: Record<Nip46Method, Nip46PermissionPolicy>
  relays: string[]
  secret?: string
  signerNpub: string
}

export type Nip46Request = {
  id: string
  method: Nip46Method
  params: string[]
  receivedAt: number
  sessionId: string
  status: 'approved' | 'pending' | 'rejected'
}

export type Nip46ParsedUri = {
  clientPubkey: string
  name?: string
  perms?: string
  relays: string[]
  secret?: string
}

export type NostrRelayReachability = 'checking' | 'connected' | 'disconnected'

export type RelayConnectionDetail = {
  url: string
  connected: boolean
  error?: string
}

export type DisconnectReason =
  | 'no_internet'
  | 'no_relays'
  | 'all_failed'
  | 'user_disabled'

export type NostrRelayConnectionInfo = {
  status: NostrRelayReachability
  reason?: DisconnectReason
  relayDetails?: RelayConnectionDetail[]
}

export type ZapPreferences = {
  presetAmounts: number[]
  oneTapAmount: number
  autoApprove: boolean
  autoApproveWalletId?: string
}

export type NostrIdentity = {
  npub: string
  nsec?: string
  mnemonic?: string
  displayName?: string
  picture?: string
  banner?: string
  nip05?: string
  lud16?: string
  /** When true, the app may query relays for this identity. Omitted or false means disconnected. */
  relayConnected?: boolean
  relays?: string[]
  zapPreferences?: ZapPreferences
  createdAt: number
  isWatchOnly: boolean
}
// Wrapped events / other devices may have clock skew; reject only if created_at
// is far in the future (match 48h subscription padding).

export const DM_FUTURE_TOLERANCE_SEC = 48 * 60 * 60

export type UnwrappedNostrEvent = {
  id: string
  pubkey: string
  content: string
  created_at?: number
  tags?: unknown[][]
}

export type NostrMessageData = {
  data_type: 'LabelsBip329' | 'Tx' | 'PSBT' | 'SignMessageRequest'
  data?: unknown
}

export type MessageHandlerContext = {
  account: Account
  unwrappedEvent: UnwrappedNostrEvent
  eventContent: Record<string, unknown>
  data?: NostrMessageData
  lastDataExchangeEOSE: number
  syncStartSec: number
  onPendingDM: (dm: PendingDM) => void
}

export type MessageHandler = {
  canHandle: (context: MessageHandlerContext) => boolean
  handle: (context: MessageHandlerContext) => void | Promise<void>
}

export type PendingDM = {
  unwrappedEvent: UnwrappedNostrEvent
  eventContent: Record<string, unknown>
  /** Set to true when the handler already showed its own toast (e.g. PSBT).
   *  storeBatch will skip the generic "New Device Message" toast. */
  skipToast?: boolean
}
export type DerivedNostrKeys = {
  nsec: string
  npub: string
  privateKey: Uint8Array
  mnemonic: string
}
export type NostrContentKind =
  | 'npub'
  | 'note'
  | 'nevent'
  | 'nprofile'
  | 'json_note'
  | 'unknown'

export type FetchedNoteData = {
  content: string
  pubkey: string
  kind: number
  tags: string[][]
  created_at: number
  authorName?: string
  authorPicture?: string
  authorLud16?: string
  authorNip05?: string
}

export type DecodedNostrContent = {
  kind: NostrContentKind
  raw: string
  data: string
  metadata?: Record<string, unknown>
  fetched?: FetchedNoteData
  isLoading?: boolean
}
export type EnhancedZapTags = {
  zapMin?: number
  zapMax?: number
  zapGoal?: number
  zapUses?: number
  zapPayer?: string
  zapLnurl?: string
}
export type NostrVideoProvider =
  | 'youtube'
  | 'vimeo'
  | 'twitch_vod'
  | 'twitch_clip'
  | 'direct'

export type NostrVideoEmbed = {
  provider: NostrVideoProvider
  watchUrl: string
  thumbnailUrl?: string
}
export type NostrSyncStatus = 'idle' | 'connecting' | 'syncing' | 'error'

export type NostrSyncStatusEvent = {
  accountId: string
  status: NostrSyncStatus
  lastError?: string
  messagesProcessed?: number
  messagesReceived?: number
}
export type NostrSubscriptionHandle = {
  accountId: string
  dataExchangeApi: NostrAPI | null
  protocolApi: NostrAPI | null
}

// export type NostrMessage = {
//   id: string
//   author: string
//   created_at: number
//   description: string
//   event: string
//   label: number
//   content: {
//     description: string
//     created_at: number
//     pubkey?: string
//   }
// }
