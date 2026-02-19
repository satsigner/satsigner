import type { NostrRelay } from '@/types/models/Nostr'

export const RELAY_PROTOCOL_PREFIX = 'wss://'

export const NOSTR_RELAYS: NostrRelay[] = [
  { name: 'Angani', url: 'wss://nostr-1.nbo.angani.co' },
  { name: 'Btc Library', url: 'wss://nostr.btc-library.com' },
  { name: 'Coracle', url: 'wss://bucket.coracle.social' },
  { name: 'Damus', url: 'wss://relay.damus.io' },
  { name: 'Data Haus', url: 'wss://nostr.data.haus' },
  { name: 'Dwadziesciajeden', url: 'wss://relay.dwadziesciajeden.pl' },
  { name: 'Einundzwanzig Space', url: 'wss://nostr.einundzwanzig.space' },
  { name: 'Mostro', url: 'wss://relay.mostro.network' },
  { name: 'Nos lol (POW 28 bits required)', url: 'wss://nos.lol' },
  { name: 'Nostr Mom', url: 'wss://nostr.mom' },
  { name: 'Nostr Wine', url: 'wss://nostr.wine' },
  { name: 'Nostromo', url: 'wss://relay.nostromo.social' },
  { name: 'Nostrue', url: 'wss://nostrue.com' },
  { name: 'Offchain', url: 'wss://offchain.pub' },
  { name: 'Openhoofd', url: 'wss://strfry.openhoofd.nl' },
  { name: 'Primal', url: 'wss://relay.primal.net' },
  { name: 'Purple Relay', url: 'wss://ch.purplerelay.com' },
  { name: 'Sathoarder', url: 'wss://nostr.sathoarder.com' },
  { name: 'Satlantis', url: 'wss://relay.satlantis.io' },
  { name: 'Schneimi', url: 'wss://nostr.schneimi.de' },
  { name: 'Snort', url: 'wss://relay.snort.social' },
  { name: 'Swiss Enigma', url: 'wss://nostr.swiss-enigma.ch' },
  { name: 'Vulpem', url: 'wss://nostr.vulpem.com' },
  { name: 'YakiHonne', url: 'wss://nostr-01.yakihonne.com' }
]
