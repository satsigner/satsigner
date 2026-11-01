import * as nostrKinds from 'nostr-tools/kinds'

import {
  DAYS_PER_WEEK,
  MS_PER_SECOND,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE
} from '@/constants/time'
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
  maxDelayMs: 60_000,
  maxRetries: 5
} as const

// NETWORK
export const NOSTR_DEFAULT_FETCH_TIMEOUT_MS = 15_000

/** Most relays cap a REQ near this, so counts on very popular notes are a floor. */
export const NOSTR_ENGAGEMENT_FETCH_LIMIT = 2000
/** Notes per engagement REQ when batching a feed window. */
export const NOSTR_ENGAGEMENT_BATCH_SIZE = 50
/** How long note rows can ask for engagement before one batched REQ goes out. */
export const NOSTR_ENGAGEMENT_BATCH_DELAY_MS = 50
export const NOSTR_DM_FUTURE_TOLERANCE_SEC = 2 * SECONDS_PER_DAY
export const NOSTR_DM_NOTIFY_MAX_AGE_SECS = 5 * SECONDS_PER_MINUTE
export const NOSTR_CHAT_PROFILE_RETRY_DELAY_MS = 5000
export const NOSTR_CHAT_THREAD_PAGE_SIZE = 200
// First open of a chat with nothing stored fetches only this many recent events.
export const NOSTR_CHAT_INITIAL_HISTORY_LIMIT = 100
export const NOSTR_CHAT_CATCH_UP_LIMIT = 500
export const NOSTR_CHAT_HISTORY_PAGE_LIMIT = 100
// Kind 4 timestamps come from the sender's clock; overlap the cursor a little.
export const NOSTR_CHAT_KIND4_CLOCK_SKEW_SEC = 10 * SECONDS_PER_MINUTE
export const NOSTR_HEX_PUBKEY_RE = /^[0-9a-f]{64}$/
// Relay events are coalesced before UI queries rerun.
export const NOSTR_UI_FLUSH_INTERVAL_MS = 250
// NIP-59 gift wraps backdate created_at by up to two days.
export const NOSTR_GIFT_WRAP_TIMESTAMP_JITTER_SEC = 2 * SECONDS_PER_DAY
export const NOSTR_EOSE_TIMEOUT_MS = 15_000
export const NOSTR_RELAY_LIST_FETCH_TIMEOUT_MS = 12_000
export const NOSTR_RELAY_POLL_INTERVAL_MS = 250
export const NOSTR_PUBLISH_RETRY_DEADLINE_MS = 4000
export const NOSTR_RELAY_PROBE_COUNT = 3
export const NOSTR_EVENT_CACHE_MAX_AGE = 3 * SECONDS_PER_DAY
export const NOSTR_EVENT_CACHE_MAX_ROWS = 5000
export const NOSTR_MAX_PROCESSED_RAW_IDS = 5000
export const NOSTR_NDK_CONNECT_TIMEOUT_MS = 20_000
// Default limit for fetchNotes/fetchFollowingTimelineNotes when the caller
// doesn't specify one.
export const NOSTR_NOTES_FETCH_DEFAULT_LIMIT = 20
export const NOSTR_PROFILE_CACHE_MAX_AGE_SECS = DAYS_PER_WEEK * SECONDS_PER_DAY
export const NOSTR_PROFILE_CACHE_TTL_SECS = SECONDS_PER_HOUR
export const NOSTR_PROTOCOL_SUBSCRIPTION_LIMIT = 5000
export const NOSTR_PROTOCOL_SUBSCRIPTION_LIMIT_FULL_SCAN = 10_000
export const NOSTR_PUBLISH_TIMEOUT_MS = 10_000
export const NOSTR_RELAY_PUBLISH_RACE_TIMEOUT_MS = 20_000
export const NOSTR_RELAY_REACHABILITY_TEST_MS = 10_000
export const NOSTR_SIGNED_EVENT_QR_MAX_CHARS = 2400
// NDK connect timeout (ms) for short-lived, temporary NDK instances used to
// fetch a single event from an explicit relay list.
export const NOSTR_TEMP_NDK_CONNECT_TIMEOUT_MS = 8000
export const NOSTR_WS_CONNECT_TIMEOUT_MS = 15_000
export const NOSTR_RELAY_COOLDOWN_MS = 2 * SECONDS_PER_MINUTE * MS_PER_SECOND
export const NOSTR_FIRST_RELAY_CONNECT_TIMEOUT_MS = 12_000
// Stays under SQLite's default bound-parameter limit (999) with room for scope.
export const NOSTR_PROCESSED_EVENTS_QUERY_CHUNK = 500

// VIDEO
export const NOSTR_VIDEO_MAX_PLAYERS = 3
export const NOSTR_VIDEO_ACTIVE_SETTLE_MS = 120
export const NOSTR_VIDEO_FAILURE_COOLDOWN_MS = 30 * MS_PER_SECOND
export const NOSTR_VIDEO_DEFAULT_ASPECT_RATIO = 16 / 9
export const NOSTR_VIDEO_VIEWABILITY_THRESHOLD_PERCENT = 50
// Device sync queue: at most this many relay events per processor flush.
export const NOSTR_QUEUE_BATCH_SIZE = 100
export const NOSTR_MAX_FAILED_WRAP_IDS = 2000
export const NOSTR_PROCESSOR_CHUNK_SIZE = 20
export const NOSTR_PENDING_DM_ID_PREFIX = 'pending-'
export const NOSTR_PENDING_MATCH_CREATED_AT_TOLERANCE_SEC = 10
export const NOSTR_TRUST_SYNC_RESTART_DELAY_MS = 1500
export const NOSTR_SYNCING_MESSAGE_ROTATE_MS = 2500
export const NOSTR_GROUP_CHAT_PAGE_SIZE = 50
export const NOSTR_GROUP_CHAT_SCROLL_THRESHOLD = 40
export const NOSTR_GROUP_CHAT_AUTOSCROLL_THRESHOLD = 0.2
export const NOSTR_GROUP_CHAT_MESSAGE_MAX_LENGTH = 500
export const NOSTR_PSBT_DETAILS_CACHE_MAX = 100
// NIP-44 encrypts at most 65535 bytes; Bitcoin Safe chunks label sync at 60k.
export const NOSTR_LABELS_MAX_CHUNK_BYTES = 60_000
export const NOSTR_BACKUP_FINGERPRINT_LENGTH = 8
// Rumors dated further ahead than this are deferred and never move a cursor.
export const NOSTR_EVENT_FUTURE_TOLERANCE_SEC = 5 * SECONDS_PER_MINUTE
// After this many handler failures an event is given up (marked processed).
export const NOSTR_EVENT_MAX_HANDLER_ATTEMPTS = 3
export const NOSTR_EVENT_FAILURE_TRACK_MAX = 2000

// UI
export const NOSTR_EMPTY_STATE_PADDING_VERTICAL = 48
export const NOSTR_FALLBACK_NPUB_COLOR = '#404040'
export const NOSTR_LIST_ITEM_GAP = 8
export const NOSTR_LIST_PADDING_VERTICAL = 8
export const NOSTR_CONTACT_QR_CODE_SIZE = 200
export const NOSTR_CONTACT_QR_CONTAINER_PADDING = 12
export const NOSTR_CONTACT_QR_PAGER_DOT_SIZE = 8
export const NOSTR_CONTACT_QR_SLIDE_KEYS = {
  LUD16: 'lud16',
  NPROFILE: 'nprofile',
  NPUB: 'npub',
  SILENT_PAYMENT: 'silent-payment'
} as const
export const NOSTR_BLOSSOM_FILE_DISPLAY_HASH_LENGTH = 12
export const NOSTR_NPUB_SHORT_HEAD_CHARS = 12
export const NOSTR_NPUB_SHORT_TAIL_CHARS = 4

// Symmetric head/tail widths for truncating an npub in the UI, tiered by how
// much horizontal space the surface has.
export const NPUB_TRUNCATE_CHARS_XS = 8
export const NPUB_TRUNCATE_CHARS_SM = 10
export const NPUB_TRUNCATE_CHARS_MD = 12
export const NPUB_TRUNCATE_CHARS_LG = 14
export const NPUB_TRUNCATE_CHARS_XL = 16
export const NOSTR_BLOSSOM_FILE_PREVIEW_HEIGHT = 280
export const NOSTR_BLOSSOM_FILES_STALE_TIME_MS = 5 * 60_000
export const NOSTR_BLOSSOM_SERVERS_STALE_TIME_MS = 10 * 60_000
export const NOSTR_PROFILE_BATCH_SIZE = 40
export const NOSTR_HIDDEN_KEY_MASK = '••••••••••••••••'
export const NOSTR_HIDDEN_KEY_MASK_LONG = '••••••••••••••••••••••••••••••••'

export { PRIVACY_MASK as NOSTR_PRIVACY_MASK } from '@/constants/privacy'

// RELAYS
export const NOSTR_RELAY_PROTOCOL_PREFIX = 'wss://'

// Project security-report contact from SECURITY.md — default recipient of the
// diagnostics live roundtrip so the check exercises the real report channel.
export const NOSTR_SECURITY_REPORT_NPUB =
  'npub1ewv0j6l7fplmadqmcmdywkff2snham403sensqlqavymt7fx7jfs58e60d'

// Well-known DM-capable relays (no PoW- or pay-gated publishing) used by the
// security/bug report form and by the diagnostics live roundtrip when the
// user has not configured relays yet.
export const NOSTR_LIVE_CHECK_FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://offchain.pub',
  'wss://relay.primal.net',
  'wss://premium.primal.net',
  'wss://relay.0xchat.com',
  'wss://relay.snort.social',
  'wss://nostr.mom',
  'wss://relay.nostr.bg',
  'wss://relay.nostrich.house',
  'wss://relay.hodlbod.com',
  'wss://relay.orangepill.dev',
  'wss://nostr.bitcoiner.social'
]

// Indexer relays used as the second tier for kind-0 profile fetches when the
// user's own relays don't have a profile (see api/nostrProfileFetcher.ts).
export const NOSTR_INDEXER_RELAYS = [
  'wss://indexer.coracle.social',
  'wss://relay.nos.social',
  'wss://nos.lol',
  'wss://indexer.nostrarchives.com',
  'wss://relay.damus.io',
  'wss://relay.primal.net'
]

export const NOSTR_RELAYS: NostrRelay[] = [
  { name: '0xchat', url: 'wss://relay.0xchat.com' },
  { name: 'Agora', url: 'wss://relay.agora.social' },
  { name: 'Angani', url: 'wss://nostr-1.nbo.angani.co' },
  { name: 'Azzamo', url: 'wss://relay.azzamo.net' },
  { name: 'Bitcoiner Social', url: 'wss://nostr.bitcoiner.social' },
  { name: 'Bostr', url: 'wss://bostr.online' },
  { name: 'Btc Library', url: 'wss://nostr.btc-library.com' },
  { name: 'Coracle', url: 'wss://bucket.coracle.social' },
  { name: 'Coracle Indexer', url: 'wss://indexer.coracle.social' },
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
  { name: 'Nos', url: 'wss://relay.nos.social' },
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
export const NOSTR_NIP01_MAX_NOTE_LENGTH = 5000
export const NOSTR_POW_DEFAULT_DIFFICULTY = 16
export const NOSTR_POW_HASHES_PER_YIELD = 1024
export const NOSTR_POW_MAX_DIFFICULTY = 24
export const NOSTR_POW_MIN_DIFFICULTY = 8
export const NOSTR_POW_NONCE_TAG = 'nonce'
export const NOSTR_NIP06_DERIVATION_PATH = "m/44'/1237'/0'/0/0"
export const NOSTR_NIP46_CONNECT_PREFIX = 'nostrconnect://'
export const NOSTR_NIP46_SUBSCRIPTION_LOOKBACK_SECONDS = 10
export const NIP46_ACTIVITY_WRITE_INTERVAL_MS =
  SECONDS_PER_MINUTE * MS_PER_SECOND
export const NOSTR_NIP46_SUPPORTED_METHODS: Nip46Method[] = [
  'connect',
  'get_public_key',
  'nip04_decrypt',
  'nip04_encrypt',
  'nip44_decrypt',
  'nip44_encrypt',
  'ping',
  'sign_event'
]
export const NOSTR_NIP46_DEFAULT_PERMISSIONS: Record<
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
// Methods that must always prompt for explicit approval, even if an
// "always allow" permission was previously stored: auto-approving decryption
// turns the signer into a permanent decryption oracle for the client.
export const NOSTR_NIP46_NEVER_AUTO_ALLOW_METHODS: Nip46Method[] = [
  'nip04_decrypt',
  'nip44_decrypt'
]
// Event kinds considered low-risk for auto-approval once the user granted
// "always allow" for sign_event. Anything else — profile (0), contacts (3),
// deletion (5), relay/bookmark lists (10002, 10003), unknown kinds — always
// requires explicit approval, since a stored permission would otherwise let
// the client silently overwrite the user's identity and lists.
export const NOSTR_NIP46_AUTO_ALLOW_SIGN_EVENT_KINDS: number[] = [
  nostrKinds.ShortTextNote,
  nostrKinds.Repost,
  nostrKinds.Reaction,
  nostrKinds.GenericRepost,
  nostrKinds.ZapRequest
]

// REGEX & FILTERS
export const NOSTR_KIND_FILTER_HIT_SLOP = 6
export const NOSTR_KIND_FILTER_TRIGGER_MAX_WIDTH = '72%'
export const NOSTR_EVENT_REF_RE = /nostr:(note1|nevent1)[a-zA-Z0-9]+/g
export const NOSTR_MENTION_RE =
  /(?:nostr:)?(npub1[a-z0-9]{6,}|nprofile1[a-z0-9]{6,})/gi
export const NOSTR_EVENT_ID_RE = /^[0-9a-fA-F]{64}$/
export const NOSTR_EVENT_ID_HEX_LENGTH = 64
export const NOSTR_PUBKEY_HEX_LENGTH = 64
export const NOSTR_SECRET_KEY_BYTE_LENGTH = 32
// Shortest plausible bech32 length for npub1/nsec1/note1/nevent1/nprofile1.
export const NOSTR_BECH32_ID_MIN_LENGTH = 60
export const NOSTR_NOTE_FILTER_OPTIONS: NostrNoteKindFilterOption[] = [
  {
    id: 'short_text',
    kinds: [nostrKinds.ShortTextNote],
    labelKey: 'nostrIdentity.feed.kindShortTextNote'
  },
  {
    id: 'long_form',
    kinds: [nostrKinds.LongFormArticle],
    labelKey: 'nostrIdentity.feed.kindLongFormContent'
  },
  {
    id: 'draft_long_form',
    kinds: [nostrKinds.DraftLong],
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
    kinds: [nostrKinds.Repost, nostrKinds.GenericRepost],
    labelKey: 'nostrIdentity.feed.kindReposts'
  },
  {
    id: 'reactions',
    kinds: [nostrKinds.Reaction],
    labelKey: 'nostrIdentity.feed.kindReaction'
  },
  {
    id: 'picture',
    kinds: [nostrKinds.Photo],
    labelKey: 'nostrIdentity.feed.kindPicture'
  },
  {
    id: 'video',
    kinds: [nostrKinds.NormalVideo, nostrKinds.ShortVideo],
    labelKey: 'nostrIdentity.feed.kindVideoEvents'
  },
  {
    id: 'file_metadata',
    kinds: [nostrKinds.FileMetadata],
    labelKey: 'nostrIdentity.feed.kindFileMetadata'
  },
  {
    id: 'poll',
    kinds: [nostrKinds.Poll],
    labelKey: 'nostrIdentity.feed.kindPoll'
  },
  {
    id: 'poll_response',
    kinds: [nostrKinds.PollResponse],
    labelKey: 'nostrIdentity.feed.kindPollResponse'
  },
  {
    id: 'label',
    kinds: [nostrKinds.Label],
    labelKey: 'nostrIdentity.feed.kindLabel'
  },
  {
    id: 'thread',
    kinds: [nostrKinds.ForumThread],
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
export const NOSTR_BLOSSOM_DEFAULT_SERVER = 'https://blossom.primal.net'
export const NOSTR_FILES_FETCH_TIMEOUT_MS = 8000
export const NOSTR_BLOSSOM_AUTH_KIND = 24_242
export const NOSTR_BLOSSOM_AUTH_EXPIRY_SECS = 300

export const NOSTR_BLOSSOM_POPULAR_SERVERS: { name: string; url: string }[] = [
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
export const NOSTR_ZAP_INVOICE_TIMEOUT_MS = 15_000
export const NOSTR_ZAP_RECEIPT_FETCH_LIMIT = 50
export const NOSTR_PUBPAY_HASHTAG = 'pubpay'
export const NOSTR_HASHTAG_TAG = 't'
export const NOSTR_ZAP_TAG_NAMES = new Set([
  'zap-goal',
  'zap-lnurl',
  'zap-max',
  'zap-min',
  'zap-payer',
  'zap-uses'
])
export const NOSTR_ZAP_CONNECT_TIMEOUT_MS = 10_000
export const NOSTR_ZAP_COLLECT_TIMEOUT_MS = 15_000

// IDENTITY FEED
export const NOSTR_FEED_PAGE_SIZE = 20
export const NOSTR_FEED_WINDOW_MAX_ITEMS = 600
export const NOSTR_FEED_MAX_EMPTY_PAGES = 3
export const NOSTR_FEED_FOLLOWING_MAX_AUTHORS = 200
export const NOSTR_FEED_NEW_NOTES_POLL_MS = 60_000
export const NOSTR_FEED_STALE_TIME_MS = 2 * SECONDS_PER_MINUTE * MS_PER_SECOND
export const NOSTR_FOLLOWS_STALE_TIME_MS =
  5 * SECONDS_PER_MINUTE * MS_PER_SECOND
export const NOSTR_PROFILE_QUERY_STALE_TIME_MS =
  SECONDS_PER_MINUTE * MS_PER_SECOND
export const NOSTR_RELAY_REACHABILITY_STALE_TIME_MS =
  5 * SECONDS_PER_MINUTE * MS_PER_SECOND
export const NOSTR_FEED_END_REACHED_THRESHOLD = 0.5
export const NOSTR_NOTE_ROW_MAX_IMAGES = 6
export const NOSTR_NOTE_ROW_MAX_VIDEOS = 4
export const NOSTR_NOTE_QUOTE_MAX_IMAGES = 2
export const NOSTR_NOTE_CONTENT_CACHE_MAX_ENTRIES = 500

// VISIBLE WINDOW
export const NOSTR_VISIBLE_WINDOW_AHEAD = 6
export const NOSTR_VISIBLE_WINDOW_BEHIND = 2

// PROFILE LOADER
export const NOSTR_PROFILE_BATCH_BUFFER_MS = 200
export const NOSTR_PROFILE_BATCH_FLUSH_AT = 100
export const NOSTR_PROFILE_FETCH_EOSE_TIMEOUT_MS = 5000
export const NOSTR_PROFILE_BACKOFF_BASE_MS = 30 * MS_PER_SECOND
export const NOSTR_PROFILE_BACKOFF_MAX_MS =
  30 * SECONDS_PER_MINUTE * MS_PER_SECOND

// EVENT CACHE
export const NOSTR_ZAP_CACHE_LOOKUP_LIMIT = 200
export const NOSTR_DELETION_FETCH_LIMIT = 100
