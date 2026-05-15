import { z } from 'zod'

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
