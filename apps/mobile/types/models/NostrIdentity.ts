export type NostrIdentity = {
  npub: string
  nsec?: string
  mnemonic?: string
  displayName?: string
  picture?: string
  nip05?: string
  lud16?: string
  relays?: string[]
  createdAt: number
  isWatchOnly: boolean
}
