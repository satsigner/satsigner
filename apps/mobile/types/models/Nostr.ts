export type NostrMessage = {
  id: string
  content: string | Record<string, unknown>
  created_at: number
  decryptedContent?: string
  isSender?: boolean
  pubkey?: string
}

export type NostrDM = {
  id: string
  author: string
  created_at: number
  description: string
  event: string
  label: number
  content: {
    description: string
    created_at: number
    pubkey?: string
  }
}

export type NostrAccount = {
  autoSync: boolean
  commonNpub: string
  commonNsec: string
  deviceNpub?: string
  deviceNsec?: string
  deviceDisplayName?: string
  devicePicture?: string
  dms: NostrDM[]
  lastBackupFingerprint?: string
  lastUpdated: Date
  npubAliases?: Record<string, string>
  relays: string[]
  syncStart: Date
  trustedMemberDevices: string[]
  relayStatuses?: Record<string, 'connected' | 'connecting' | 'disconnected'>
}

export type NostrKind0Profile = {
  displayName?: string
  picture?: string
}

export type NostrKeys = {
  nsec: string
  npub: string
  secretNostrKey: Uint8Array
}

export type NostrRelay = {
  url: string
  name: string
}
