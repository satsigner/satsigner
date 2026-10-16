export const SATS_PER_BITCOIN = 100_000_000
export const BTC_DECIMALS = 8
// Typical payment finality: 6 confirmations.
export const FULLY_CONFIRMED_COUNT = 6
// Default Bitcoin P2P protocol port on mainnet.
export const MAINNET_P2P_PORT = 8333
// A txid or block hash: 32 bytes, 64 hex characters.
export const HASH_BYTE_LENGTH = 32
export const HASH_HEX_LENGTH = HASH_BYTE_LENGTH * 2
export const TXID_HEX_PATTERN = new RegExp(`^[0-9a-fA-F]{${HASH_HEX_LENGTH}}$`)
export const COINBASE_PREV_TXID = '0'.repeat(HASH_HEX_LENGTH)
// nSequence values: final (no RBF, no relative locktime) and BIP125 opt-in RBF.
export const SEQUENCE_FINAL = 0xff_ff_ff_ff
export const SEQUENCE_RBF = 0xff_ff_ff_fd
// Prevout index used by coinbase and BIP322 virtual inputs.
export const NULL_PREVOUT_INDEX = 0xff_ff_ff_ff
export const UNKNOWN_MASTER_FINGERPRINT = '00000000'
export const MILLISATS_PER_SAT = 1000
export const DUST_LIMIT = 546
export const UNUSED_INTERNAL_ADDRESSES_NEEDED = 3

// BIP141: 1 non-witness byte = 4 weight units, 1 witness byte = 1 weight unit.
// vsize = ceil(weight / WITNESS_SCALE_FACTOR).
export const WITNESS_SCALE_FACTOR = 4

// BIP174 PSBT magic bytes ("psbt" + 0xff separator), hex-encoded.
export const PSBT_MAGIC_HEX = '70736274ff'

export const BITCOIN_URI_SCHEME = 'bitcoin:'
// Output amount placeholder the user fills in on ioPreview.
export const UNSET_OUTPUT_AMOUNT_SATS = 1
export const BARE_BITCOIN_ADDRESS_PATTERN = /^[a-zA-Z0-9]{26,62}$/
export const HEX_PATTERN = /^[0-9a-fA-F]+$/
