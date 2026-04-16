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

export type NostrIdentity = {
  npub: string
  nsec?: string
  mnemonic?: string
  displayName?: string
  picture?: string
  nip05?: string
  lud16?: string
  /** When true, the app may query relays for this identity. Omitted or false means disconnected. */
  relayConnected?: boolean
  relays?: string[]
  createdAt: number
  isWatchOnly: boolean
}
