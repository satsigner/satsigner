import { type PayjoinCoordinationMode } from '@/types/payjoin'

/** Default BIP77 Payjoin Directory (Bull Bitcoin / Payjoin Foundation ecosystem). */
const PAYJOIN_DIRECTORY_URL = 'https://payjo.in'

/**
 * Default coordination mode. Directory remains the interop default; Manual is an
 * opt-in fully-offline out-of-band handoff.
 */
const PAYJOIN_DEFAULT_COORDINATION_MODE: PayjoinCoordinationMode = 'directory'

/**
 * Default OHTTP relays. Callers must shuffle before use to avoid network-layer
 * fingerprinting (Bull Bitcoin #1906 / rust-payjoin#1328).
 */
const PAYJOIN_OHTTP_RELAY_URLS = [
  'https://ohttp.achow101.com',
  'https://pj.bobspacebkk.com'
  // cakewallet often fails Android OkHttp (HTTP/2 SETTINGS preface) and then
  // native HTTP/1.1 as well — leave it out so sessions are not bound to a dead relay.
] as const

/** Default receiver session TTL (5 minutes). */
const PAYJOIN_SESSION_TTL_MS = 5 * 60 * 1000

/** Allowed session TTL presets for settings (1 / 5 / 10 minutes). */
const PAYJOIN_SESSION_TTL_PRESETS_MS = [
  1 * 60 * 1000,
  5 * 60 * 1000,
  10 * 60 * 1000
] as const

/** BIP78 synchronous request timeout. */
const PAYJOIN_BIP78_TIMEOUT_MS = 30_000

/** Fetch abort timeout applied to every outbound payjoin HTTP request. */
const PAYJOIN_FETCH_TIMEOUT_MS = 90_000

/** Native (Rust) HTTP POST timeout used by both the OHTTP and direct paths. */
const PAYJOIN_NATIVE_HTTP_TIMEOUT_MS = 45_000

/** BIP77 poll timeout before falling back to a normal transaction. */
const PAYJOIN_BIP77_SEND_TIMEOUT_MS = 60_000

/** Default deadline for the sender's initial quick-poll loop. */
const PAYJOIN_QUICK_POLL_DEFAULT_MS = 3_000

/** Delay between quick-poll attempts while awaiting the receiver's response. */
const PAYJOIN_QUICK_POLL_INTERVAL_MS = 400

/** Upper bound applied to the quick-poll deadline derived from a caller timeout. */
const PAYJOIN_QUICK_POLL_MAX_MS = 5_000

/** Default timeout for resuming and polling a persisted receiver session. */
const PAYJOIN_RESUME_POLL_DEFAULT_TIMEOUT_MS = 15_000

/** Delay between poll attempts while resuming a receiver session. */
const PAYJOIN_RESUME_POLL_INTERVAL_MS = 500

/** Default: do not allow payment output substitution (Bull Bitcoin parity). */
const PAYJOIN_DEFAULT_PJOS: 0 | 1 = 0

/**
 * Minimum BIP21 receive amount (sats) before a Payjoin `pj=` is advertised.
 * Below this floor the QR stays plain BIP21 while the mailbox can remain alive
 * (anti-probing / Bull Bitcoin parity).
 */
const PAYJOIN_MIN_RECEIVE_SATS = 5_000

/**
 * Minimum UTXO value (sats) a receiver must have to contribute an input.
 * Empty / dust-only wallets cannot complete a Payjoin as receiver.
 */
const PAYJOIN_MIN_CONTRIBUTE_SATS = 5_000

/** Payment amount (sats) used by the in-app Signet BIP77 diagnostics roundtrip. */
const PAYJOIN_LIVE_ROUNDTRIP_PAYMENT_SATS = 5_000

/** Absolute fee (sats) for the diagnostics original PSBT on Signet. */
const PAYJOIN_LIVE_ROUNDTRIP_FEE_SATS = 500

/**
 * Floor for a receiver mailbox lifetime. PDK rejects very short expirations, and
 * a session shorter than this cannot survive the sender's first poll.
 */
const PAYJOIN_MIN_SESSION_EXPIRE_SECONDS = 60

/**
 * Sentinel returned by the OHTTP key probe. The keys object itself is not
 * serializable across the native boundary, and callers only use the probe to
 * confirm a relay is reachable before creating a session.
 */
const PAYJOIN_OHTTP_KEYS_PROBE_OK = 'ohttp-keys-ok'

/**
 * Throwaway BIP21 URI used to confirm the native bindings are loaded. Parsed
 * only for its side effect of crossing into Rust; the result is discarded.
 */
const PAYJOIN_NATIVE_PROBE_URI =
  'bitcoin:tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx?pj=https://payjo.in'

/**
 * Raised when a board payjoin proposal's txid could change once the sender
 * signs (legacy or P2SH-wrapped inputs). Bark registers the pending board
 * under the unsigned proposal's txid and watches the chain for it, so an
 * unstable txid would leave the board funds unclaimable without manual
 * recovery. Matched as a terminal error by the receiver hook.
 */
const PAYJOIN_BOARD_TXID_UNSTABLE_ERROR =
  'board payjoin requires segwit sender inputs (proposal txid not stable)'

/**
 * Bark refused to cosign the board. The native proposal is consumed by then,
 * so the receiver hook treats this as terminal and the user mints a new QR.
 */
const PAYJOIN_BOARD_COSIGN_FAILED_ERROR = 'board cosign failed'

/**
 * A retry re-derived a proposal whose txid differs from the one bark already
 * registered. Posting it would fund an untracked board, so the retry stops.
 */
const PAYJOIN_BOARD_TXID_MISMATCH_ERROR = 'board proposal txid changed on retry'

export {
  PAYJOIN_BIP77_SEND_TIMEOUT_MS,
  PAYJOIN_BIP78_TIMEOUT_MS,
  PAYJOIN_BOARD_COSIGN_FAILED_ERROR,
  PAYJOIN_BOARD_TXID_MISMATCH_ERROR,
  PAYJOIN_BOARD_TXID_UNSTABLE_ERROR,
  PAYJOIN_DEFAULT_COORDINATION_MODE,
  PAYJOIN_DEFAULT_PJOS,
  PAYJOIN_DIRECTORY_URL,
  PAYJOIN_FETCH_TIMEOUT_MS,
  PAYJOIN_LIVE_ROUNDTRIP_FEE_SATS,
  PAYJOIN_LIVE_ROUNDTRIP_PAYMENT_SATS,
  PAYJOIN_MIN_CONTRIBUTE_SATS,
  PAYJOIN_MIN_RECEIVE_SATS,
  PAYJOIN_MIN_SESSION_EXPIRE_SECONDS,
  PAYJOIN_NATIVE_HTTP_TIMEOUT_MS,
  PAYJOIN_NATIVE_PROBE_URI,
  PAYJOIN_OHTTP_KEYS_PROBE_OK,
  PAYJOIN_OHTTP_RELAY_URLS,
  PAYJOIN_QUICK_POLL_DEFAULT_MS,
  PAYJOIN_QUICK_POLL_INTERVAL_MS,
  PAYJOIN_QUICK_POLL_MAX_MS,
  PAYJOIN_RESUME_POLL_DEFAULT_TIMEOUT_MS,
  PAYJOIN_RESUME_POLL_INTERVAL_MS,
  PAYJOIN_SESSION_TTL_MS,
  PAYJOIN_SESSION_TTL_PRESETS_MS
}
