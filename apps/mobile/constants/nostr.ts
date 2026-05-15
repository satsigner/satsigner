import type {
  Nip46Method,
  Nip46PermissionPolicy,
  NostrRelay
} from '@/types/models/Nostr'

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
export const NOSTR_RELAY_REACHABILITY_TEST_MS = 10000
export const NIP46_EVENT_KIND = 24133

export const NIP46_SUPPORTED_METHODS: Nip46Method[] = [
  'connect',
  'get_public_key',
  'nip04_decrypt',
  'nip04_encrypt',
  'nip44_decrypt',
  'nip44_encrypt',
  'ping',
  'sign_event'
]

export const NIP46_DEFAULT_PERMISSIONS: Record<
  Nip46Method,
  Nip46PermissionPolicy
> = {
  connect: 'always_allow',
  get_public_key: 'always_allow',
  nip04_decrypt: 'ask',
  nip04_encrypt: 'ask',
  nip44_decrypt: 'ask',
  nip44_encrypt: 'ask',
  ping: 'always_allow',
  sign_event: 'ask'
}

export const NIP46_REQUEST_TIMEOUT_MS = 60000

export const NIP46_NOSTR_CONNECT_PREFIX = 'nostrconnect://'

export const NIP46_SUBSCRIPTION_LOOKBACK_SECONDS = 10

export const NIP46_EVENT_PREVIEW_MAX_LENGTH = 200

export const NIP06_DERIVATION_PATH = "m/44'/1237'/0'/0/0"

export const NOSTR_EVENT_REF_RE = /nostr:(note1|nevent1)[a-zA-Z0-9]+/g

export const MENTION_RE =
  /(?:nostr:)?(npub1[a-z0-9]{6,}|nprofile1[a-z0-9]{6,})/gi

export const NOSTR_EVENT_ID_HEX = /^[0-9a-fA-F]{64}$/

export { PRIVACY_MASK as NOSTR_PRIVACY_MASK } from '@/constants/privacy'
/** Shown in place of hidden secret keys (nsec / seed words) — short form. */
export const NOSTR_HIDDEN_KEY_MASK = '••••••••••••••••'
/** Shown in place of hidden secret keys — long form for full-width displays. */
export const NOSTR_HIDDEN_KEY_MASK_LONG = '••••••••••••••••••••••••••••••••'

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

/** Maximum character length for a kind-1 note composed in-app. */
export const MAX_NOTE_LENGTH = 5000

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
