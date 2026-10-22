export const SATS_PER_BITCOIN = 100_000_000
// Typical payment finality: 6 confirmations.
export const FULLY_CONFIRMED_COUNT = 6
// Default Bitcoin P2P protocol port on mainnet.
export const MAINNET_P2P_PORT = 8333
export const UNKNOWN_MASTER_FINGERPRINT = '00000000'
export const MILLISATS_PER_SAT = 1000
export const DUST_LIMIT = 546
// BIP125: a transaction signals replaceability when any input sequence is
// below 0xfffffffe. Wallets use 0xfffffffd. 0xffffffff is final.
export const BIP125_REPLACEABLE_SEQUENCE_BELOW = 0xfffffffe
export const RBF_SIGNAL_SEQUENCE = 0xfffffffd
export const FINAL_SEQUENCE = 0xffffffff
// Bitcoin Core default incremental relay fee: 1 sat/vB on the replacement size.
export const INCREMENTAL_RELAY_FEE_RATE = 1
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
