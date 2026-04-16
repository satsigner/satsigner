export type NostrRelayReachability = 'checking' | 'connected' | 'disconnected'

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
