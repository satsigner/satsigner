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
export const NOSTR_PUBLISH_TIMEOUT_MS = 10000
export const NOSTR_RELAY_REACHABILITY_TEST_MS = 10000
export const NOSTR_SIGNED_EVENT_QR_MAX_CHARS = 2400
export const NOSTR_WS_CONNECT_TIMEOUT_MS = 15000

// UI
export const NOSTR_ACCOUNT_CARD_ESTIMATED_HEIGHT = 120
export const NOSTR_EMPTY_STATE_PADDING_VERTICAL = 48
export const NOSTR_FALLBACK_NPUB_COLOR = '#404040'
export const NOSTR_LIST_ITEM_GAP = 8
export const NOSTR_LIST_PADDING_VERTICAL = 8
export const NOSTR_PROFILE_BATCH_SIZE = 40
export const NOSTR_HIDDEN_KEY_MASK = '••••••••••••••••'
export const NOSTR_HIDDEN_KEY_MASK_LONG = '••••••••••••••••••••••••••••••••'

export { PRIVACY_MASK as NOSTR_PRIVACY_MASK } from '@/constants/privacy'

// RELAYS
export const NOSTR_RELAY_PROTOCOL_PREFIX = 'wss://'
export const NOSTR_RELAYS: NostrRelay[] = [
  { name: '0xchat', url: 'wss://relay.0xchat.com' },
  { name: 'Agora', url: 'wss://relay.agora.social' },
  { name: 'Angani', url: 'wss://nostr-1.nbo.angani.co' },
  { name: 'Azzamo', url: 'wss://relay.azzamo.net' },
  { name: 'Bitcoiner Social', url: 'wss://nostr.bitcoiner.social' },
  { name: 'Bostr', url: 'wss://bostr.online' },
  { name: 'Btc Library', url: 'wss://nostr.btc-library.com' },
  { name: 'Coracle', url: 'wss://bucket.coracle.social' },
  { name: 'Creatr', url: 'wss://creatr.nostr.wine' },
  { name: 'Damus', url: 'wss://relay.damus.io' },
  { name: 'Data Haus', url: 'wss://nostr.data.haus' },
  { name: 'Dwadziesciajeden', url: 'wss://relay.dwadziesciajeden.pl' },
  { name: 'Einundzwanzig Space', url: 'wss://nostr.einundzwanzig.space' },
  { name: 'Flashsoft', url: 'wss://relay.flashsoft.eu' },
  { name: 'Hodlbod', url: 'wss://relay.hodlbod.com' },
  { name: 'JB55', url: 'wss://relay.jb55.com' },
  { name: 'Lume', url: 'wss://relay.lume.nu' },
  { name: 'Mostro', url: 'wss://relay.mostro.network' },
  { name: 'Mutinywallet', url: 'wss://nostr.mutinywallet.com' },
  { name: 'Nos lol (POW 28 bits required)', url: 'wss://nos.lol' },
  { name: 'Nostr Band', url: 'wss://relay.nostr.band' },
  { name: 'Nostr BG', url: 'wss://relay.nostr.bg' },
  { name: 'Nostr Land', url: 'wss://relay.nostr.land' },
  { name: 'Nostr Mom', url: 'wss://nostr.mom' },
  { name: 'Nostr Online', url: 'wss://relay.nostr.online' },
  { name: 'Nostr Wine', url: 'wss://nostr.wine' },
  { name: 'Nostr World', url: 'wss://relay.nostr.world' },
  { name: 'Nostrich House', url: 'wss://relay.nostrich.house' },
  { name: 'Nostromo', url: 'wss://relay.nostromo.social' },
  { name: 'Nostrue', url: 'wss://nostrue.com' },
  { name: 'Offchain', url: 'wss://offchain.pub' },
  { name: 'Openhoofd', url: 'wss://strfry.openhoofd.nl' },
  { name: 'Orangepill', url: 'wss://relay.orangepill.dev' },
  { name: 'Plebs Town', url: 'wss://relay.plebs.town' },
  { name: 'Plebstr', url: 'wss://plebstr.com' },
  { name: 'Primal', url: 'wss://relay.primal.net' },
  { name: 'Primal Premium', url: 'wss://premium.primal.net' },
  { name: 'Purple Relay', url: 'wss://ch.purplerelay.com' },
  { name: 'Purplepag.es', url: 'wss://purplepag.es' },
  { name: 'Sathoarder', url: 'wss://nostr.sathoarder.com' },
  { name: 'Satlantis', url: 'wss://relay.satlantis.io' },
  { name: 'Satoshi Stream', url: 'wss://relay.satoshi.stream' },
  { name: 'Schneimi', url: 'wss://nostr.schneimi.de' },
  { name: 'Siamstr', url: 'wss://siamstr.com' },
  { name: 'Snort', url: 'wss://relay.snort.social' },
  { name: 'Stacker News', url: 'wss://relay.stacker.news' },
  { name: 'Swiss Enigma', url: 'wss://nostr.swiss-enigma.ch' },
  { name: 'The Dude', url: 'wss://relay.thedude.cloud' },
  { name: 'Utxo One', url: 'wss://relay.utxo.one' },
  { name: 'Vulpem', url: 'wss://nostr.vulpem.com' },
  { name: 'Wellorder', url: 'wss://wellorder.net' },
  { name: 'YakiHonne', url: 'wss://nostr-01.yakihonne.com' },
  { name: 'Yakihonne', url: 'wss://relay.yakihonne.com' },
  { name: 'Zap Band', url: 'wss://relay.zap.band' },
  { name: 'Zapstore', url: 'wss://relay.zapstore.dev' }
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

// BLOSSOM
export const BLOSSOM_DEFAULT_SERVER = 'https://blossom.primal.net'

export const BLOSSOM_POPULAR_SERVERS: { name: string; url: string }[] = [
  { name: 'Primal', url: 'https://blossom.primal.net' },
  { name: 'Satellite', url: 'https://cdn.satellite.earth' },
  { name: 'Blossom Band', url: 'https://blossom.band' },
  { name: 'nostr.download', url: 'https://nostr.download' },
  { name: 'Media Nostr Band', url: 'https://media.nostr.band' },
  { name: 'Nostr Build', url: 'https://blossom.nostr.build' }
]

// ZAP
export const NOSTR_ZAP_DEFAULT_PRESETS = [21, 100, 500, 1000]
export const NOSTR_ZAP_DEFAULT_ONE_TAP_AMOUNT = 21
export const NOSTR_ZAP_INVOICE_TIMEOUT_MS = 15000
export const NOSTR_ZAP_RECEIPT_FETCH_LIMIT = 50
export const NOSTR_ZAP_TAG_NAMES = new Set([
  'zap-goal',
  'zap-lnurl',
  'zap-max',
  'zap-min',
  'zap-payer',
  'zap-uses'
])
