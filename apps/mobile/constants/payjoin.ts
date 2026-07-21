/** Default BIP77 Payjoin Directory (Bull Bitcoin / Payjoin Foundation ecosystem). */
const PAYJOIN_DIRECTORY_URL = 'https://payjo.in'

/**
 * Default OHTTP relays. Callers must shuffle before use to avoid network-layer
 * fingerprinting (Bull Bitcoin #1906 / rust-payjoin#1328).
 */
const PAYJOIN_OHTTP_RELAY_URLS = [
  'https://ohttp.achow101.com',
  'https://pj.bobspacebkk.com',
  'https://ohttp.cakewallet.com'
] as const

/** Default receiver session TTL (10 minutes), matching PDK tutorial defaults. */
const PAYJOIN_SESSION_TTL_MS = 10 * 60 * 1000

/** BIP78 synchronous request timeout. */
const PAYJOIN_BIP78_TIMEOUT_MS = 30_000

/** BIP77 poll timeout before falling back to a normal transaction. */
const PAYJOIN_BIP77_SEND_TIMEOUT_MS = 60_000

/** Default: do not allow payment output substitution (Bull Bitcoin parity). */
const PAYJOIN_DEFAULT_PJOS: 0 | 1 = 0

export {
  PAYJOIN_BIP77_SEND_TIMEOUT_MS,
  PAYJOIN_BIP78_TIMEOUT_MS,
  PAYJOIN_DEFAULT_PJOS,
  PAYJOIN_DIRECTORY_URL,
  PAYJOIN_OHTTP_RELAY_URLS,
  PAYJOIN_SESSION_TTL_MS
}
