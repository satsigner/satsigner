export const REDACTED = '[redacted]'

const BASE58 = '1-9A-HJ-NP-Za-km-z'
const BECH32 = '02-9ac-hj-np-z'

const EXTENDED_PRIVATE_KEY = new RegExp(`\\b[a-zA-Z]prv[${BASE58}]{100,}`, 'g')
const NOSTR_SECRET_KEY = new RegExp(`\\bnsec1[${BECH32}]{20,}`, 'gi')
// Mainnet (5, K, L) and testnet (9, c) WIF private keys.
const WIF_PRIVATE_KEY = new RegExp(`\\b[5KLc9][${BASE58}]{50,51}\\b`, 'g')
const LABELLED_HEX_SECRET =
  /(\b\w*(?:priv|secret|seed)\w*(?:\s+key)?["']?\s*[:=]?\s*["']?)(?:0x)?[0-9a-fA-F]{64}\b/gi
const BASE64_PSBT = /cHNidP8[A-Za-z0-9+/=]*/g
const HEX_PSBT = /\b70736274ff[0-9a-fA-F]*/gi

/**
 * Masks the secrets most likely to reach a log line. Mnemonics are not
 * caught: word lists look like ordinary text.
 */
export function redactSecrets(text: string): string {
  return text
    .replace(EXTENDED_PRIVATE_KEY, REDACTED)
    .replace(NOSTR_SECRET_KEY, REDACTED)
    .replace(WIF_PRIVATE_KEY, REDACTED)
    .replace(LABELLED_HEX_SECRET, `$1${REDACTED}`)
    .replace(BASE64_PSBT, REDACTED)
    .replace(HEX_PSBT, REDACTED)
}
