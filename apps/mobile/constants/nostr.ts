export type NostrRelay = {
  url: string
  name: string
}

export const NOSTR_RELAYS: NostrRelay[] = [
  { url: 'wss://nos.lol', name: 'Nos.lol' },
  { url: 'wss://nostr.mom', name: 'Nostr Mom' },
  { url: 'wss://nostr.wine', name: 'Nostr Wine' },
  { url: 'wss://offchain.pub', name: 'Offchain' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
  { url: 'wss://relay.snort.social', name: 'Snort' }
]
