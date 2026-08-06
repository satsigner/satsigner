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

/** BIP77 poll timeout before falling back to a normal transaction. */
const PAYJOIN_BIP77_SEND_TIMEOUT_MS = 60_000

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

export {
  PAYJOIN_BIP77_SEND_TIMEOUT_MS,
  PAYJOIN_BIP78_TIMEOUT_MS,
  PAYJOIN_DEFAULT_COORDINATION_MODE,
  PAYJOIN_DEFAULT_PJOS,
  PAYJOIN_DIRECTORY_URL,
  PAYJOIN_LIVE_ROUNDTRIP_FEE_SATS,
  PAYJOIN_LIVE_ROUNDTRIP_PAYMENT_SATS,
  PAYJOIN_MIN_CONTRIBUTE_SATS,
  PAYJOIN_MIN_RECEIVE_SATS,
  PAYJOIN_MIN_SESSION_EXPIRE_SECONDS,
  PAYJOIN_NATIVE_PROBE_URI,
  PAYJOIN_OHTTP_KEYS_PROBE_OK,
  PAYJOIN_OHTTP_RELAY_URLS,
  PAYJOIN_SESSION_TTL_MS,
  PAYJOIN_SESSION_TTL_PRESETS_MS
}
