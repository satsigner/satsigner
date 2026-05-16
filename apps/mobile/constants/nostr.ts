import type {
  Nip46Method,
  Nip46PermissionPolicy,
  NostrNoteKindFilterOption,
  NostrRelay
} from '@/types/models/Nostr'

// CONFIG
export const NOSTR_DEFAULT_RETRY_CONFIG = {
  baseDelayMs: 1000,
  jitterFactor: 0.2,
  maxDelayMs: 60000,
  maxRetries: 5
} as const

// NETWORK
export const NOSTR_DELAY_BETWEEN_PUBLISHES_MS = 400
export const NOSTR_DM_FUTURE_TOLERANCE_SEC = 48 * 60 * 60
export const NOSTR_EOSE_TIMEOUT_MS = 15000
export const NOSTR_EVENT_CACHE_MAX_AGE = 259200
export const NOSTR_EVENT_CACHE_MAX_ROWS = 5000
export const NOSTR_FLUSH_QUEUE_DELAY_MS = 50
export const NOSTR_MAX_PROCESSED_ITEMS = 2000
export const NOSTR_MAX_PROCESSED_RAW_IDS = 5000
export const NOSTR_MAX_QUEUE_SIZE = 300
export const NOSTR_NDK_CONNECT_TIMEOUT_MS = 20000
export const NOSTR_PROCESSING_INTERVAL_MS = 350
export const NOSTR_PROFILE_CACHE_MAX_AGE_SECS = 604800
export const NOSTR_PROFILE_CACHE_TTL_SECS = 3600
export const NOSTR_PROTOCOL_SUBSCRIPTION_LIMIT = 5000
export const NOSTR_PROTOCOL_SUBSCRIPTION_LIMIT_FULL_SCAN = 10000
export const NOSTR_RELAY_REACHABILITY_TEST_MS = 10000
export const NOSTR_SIGNED_EVENT_QR_MAX_CHARS = 2400

// UI
export const NOSTR_FALLBACK_NPUB_COLOR = '#404040'
export { PRIVACY_MASK as NOSTR_PRIVACY_MASK } from '@/constants/privacy'
export const NOSTR_HIDDEN_KEY_MASK = '••••••••••••••••'
export const NOSTR_HIDDEN_KEY_MASK_LONG = '••••••••••••••••••••••••••••••••'

// RELAYS
export const NOSTR_RELAY_PROTOCOL_PREFIX = 'wss://'
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

// NIPS
export const NIP01_MAX_NOTE_LENGTH = 5000
export const NIP06_DERIVATION_PATH = "m/44'/1237'/0'/0/0"
export const NIP46_EVENT_KIND = 24133
export const NIP46_EVENT_PREVIEW_MAX_LENGTH = 200
export const NIP46_NOSTR_CONNECT_PREFIX = 'nostrconnect://'
export const NIP46_REQUEST_TIMEOUT_MS = 60000
export const NIP46_SUBSCRIPTION_LOOKBACK_SECONDS = 10
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

// REGEX & FILTERS
export const NOSTR_EVENT_REF_RE = /nostr:(note1|nevent1)[a-zA-Z0-9]+/g
export const NOSTR_MENTION_RE =
  /(?:nostr:)?(npub1[a-z0-9]{6,}|nprofile1[a-z0-9]{6,})/gi
export const NOSTR_EVENT_ID_RE = /^[0-9a-fA-F]{64}$/
export const NOSTR_NOTE_FILTER_OPTIONS: NostrNoteKindFilterOption[] = [
  {
    id: 'short_text',
    kinds: [1],
    labelKey: 'nostrIdentity.feed.kindShortTextNote'
  },
  {
    id: 'long_form',
    kinds: [30023],
    labelKey: 'nostrIdentity.feed.kindLongFormContent'
  },
  {
    id: 'draft_long_form',
    kinds: [30024],
    labelKey: 'nostrIdentity.feed.kindDraftLongFormContent'
  },
  {
    id: 'bookmarks',
    kinds: [],
    labelKey: 'nostrIdentity.feed.kindBookmarks'
  },
  {
    id: 'private_bookmarks',
    kinds: [],
    labelKey: 'nostrIdentity.feed.kindPrivateBookmarks'
  },
  {
    id: 'reposts',
    kinds: [6, 16],
    labelKey: 'nostrIdentity.feed.kindReposts'
  },
  {
    id: 'reactions',
    kinds: [7],
    labelKey: 'nostrIdentity.feed.kindReaction'
  },
  {
    id: 'picture',
    kinds: [20],
    labelKey: 'nostrIdentity.feed.kindPicture'
  },
  {
    id: 'video',
    kinds: [21, 22],
    labelKey: 'nostrIdentity.feed.kindVideoEvents'
  },
  {
    id: 'file_metadata',
    kinds: [1063],
    labelKey: 'nostrIdentity.feed.kindFileMetadata'
  },
  {
    id: 'poll_response',
    kinds: [1018],
    labelKey: 'nostrIdentity.feed.kindPollResponse'
  },
  {
    id: 'label',
    kinds: [1985],
    labelKey: 'nostrIdentity.feed.kindLabel'
  },
  {
    id: 'thread',
    kinds: [11],
    labelKey: 'nostrIdentity.feed.kindThread'
  }
]

// BOOKMARKS
export const NOSTR_BOOKMARKS_PAGE_SIZE = 10
export const NOSTR_BOOKMARKS_MAX_FETCH = 100
export const NOSTR_BOOKMARKS_FILTER_IDS = new Set([
  'bookmarks',
  'private_bookmarks'
])

// ZAP
export const NOSTR_ZAP_DEFAULT_PRESETS = [21, 100, 500, 1000]
export const NOSTR_ZAP_DEFAULT_ONE_TAP_AMOUNT = 21
