import type { NostrRelay } from '@/types/models/Nostr'

export const DEFAULT_RETRY_CONFIG = {
  baseDelayMs: 1000,
  jitterFactor: 0.2,
  maxDelayMs: 60000,
  maxRetries: 5
}
export const DELAY_BETWEEN_PUBLISHES_MS = 400
export const EOSE_TIMEOUT_MS = 15000
export const FLUSH_QUEUE_DELAY_MS = 50
/** Max number of processed events/messages to keep per account (prevents unbounded memory growth). */
export const MAX_PROCESSED_ITEMS = 2000
export const MAX_PROCESSED_RAW_IDS = 5000
export const MAX_QUEUE_SIZE = 300
/** Request enough kind 1059 events to discover all device announcements (members). Relays often default to ~100.
 *  Use a high limit because relay event order is not guaranteed (some return oldest-first); otherwise we can
 *  miss recent announcements when the relay returns oldest events first and we hit the limit. */
export const PROTOCOL_SUBSCRIPTION_LIMIT = 5000
/** When doing a full rescan (since=0), request more events to reduce chance of missing new announcements. */
export const PROTOCOL_SUBSCRIPTION_LIMIT_FULL_SCAN = 10000
export const PROCESSING_INTERVAL_MS = 350
export const RELAY_PROTOCOL_PREFIX = 'wss://'
/** Fallback color when npub is missing, invalid, or member has no color (e.g. device/member list UI). */
export const NOSTR_FALLBACK_NPUB_COLOR = '#404040'
/** Short NDK connect when probing whether at least one relay is reachable. */
export const NOSTR_RELAY_REACHABILITY_TEST_MS = 5000
/** Shown when settings privacy mode hides Nostr amounts and identifiers. */
export const NOSTR_PRIVACY_MASK = '••••'

export const NOSTR_RELAYS: NostrRelay[] = [
  { name: 'Angani', url: 'wss://nostr-1.nbo.angani.co' },
  { name: 'Bitcoiner Social', url: 'wss://nostr.bitcoiner.social' },
  { name: 'Btc Library', url: 'wss://nostr.btc-library.com' },
  { name: 'Coracle', url: 'wss://bucket.coracle.social' },
  { name: 'Damus', url: 'wss://relay.damus.io' },
  { name: 'Data Haus', url: 'wss://nostr.data.haus' },
  { name: 'Dwadziesciajeden', url: 'wss://relay.dwadziesciajeden.pl' },
  { name: 'Einundzwanzig Space', url: 'wss://nostr.einundzwanzig.space' },
  { name: 'Mostro', url: 'wss://relay.mostro.network' },
  { name: 'Nos lol (POW 28 bits required)', url: 'wss://nos.lol' },
  { name: 'Nostr Band', url: 'wss://relay.nostr.band' },
  { name: 'Nostr BG', url: 'wss://relay.nostr.bg' },
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

export const DEFAULT_ZAP_PRESETS = [21, 100, 500, 1000]
export const DEFAULT_ONE_TAP_AMOUNT = 21

/** Compact signed-event JSON longer than this is not shown as QR (QR version limits). */
export const NOSTR_SIGNED_EVENT_QR_MAX_CHARS = 2400

/** Profile cache: re-fetch from relays if cached profile is older than this. */
export const PROFILE_CACHE_TTL_SECS = 3600
/** Profile cache: delete stale profiles older than this on prune. */
export const PROFILE_CACHE_MAX_AGE_SECS = 604800
/** Event cache: auto-prune non-own events older than this (3 days). */
export const OTHER_EVENT_CACHE_MAX_AGE_SECS = 259200
/** Event cache: hard cap on non-own rows; oldest by cached_at are removed first. */
export const EVENT_CACHE_MAX_ROWS = 5000
