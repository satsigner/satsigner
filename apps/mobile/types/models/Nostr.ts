export interface NostrMessage {
  id: string
  content: string | Record<string, unknown>
  created_at: number
  decryptedContent?: string
  isSender?: boolean
  pubkey?: string
}

export interface NostrDM {
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
  /** True when message was sent from this device but not yet confirmed from relay */
  pending?: boolean
  /** False when this incoming message has not yet been viewed in the chat.
   *  Undefined means the message predates the unread-tracking feature (treat as read). */
  read?: boolean
}

export interface NostrAccount {
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
  npubProfiles?: Record<string, { displayName?: string; picture?: string }>
  relays: string[]
  syncStart: Date
  trustedMemberDevices: string[]
  relayStatuses?: Record<string, 'connected' | 'connecting' | 'disconnected'>
}

export interface NostrKind0Profile {
  displayName?: string
  picture?: string
}

export interface NostrKeys {
  nsec: string
  npub: string
  secretNostrKey: Uint8Array
}

export interface NostrRelay {
  url: string
  name: string
}
