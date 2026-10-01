export const SATS_PER_BITCOIN = 100_000_000
// Typical payment finality: 6 confirmations.
export const FULLY_CONFIRMED_COUNT = 6
// Default Bitcoin P2P protocol port on mainnet.
export const MAINNET_P2P_PORT = 8333
export const UNKNOWN_MASTER_FINGERPRINT = '00000000'
export const MILLISATS_PER_SAT = 1000
export const DUST_LIMIT = 546
export const UNUSED_INTERNAL_ADDRESSES_NEEDED = 3

// BIP141: 1 non-witness byte = 4 weight units, 1 witness byte = 1 weight unit.
// vsize = ceil(weight / WITNESS_SCALE_FACTOR).
export const WITNESS_SCALE_FACTOR = 4

// BIP174 PSBT magic bytes ("psbt" + 0xff separator), hex-encoded.
export const PSBT_MAGIC_HEX = '70736274ff'

// BIP174 PSBT magic bytes as they appear at the start of a base64 PSBT.
export const PSBT_MAGIC_BASE64 = 'cHNidP'

// A txid is 32 bytes, shown as 64 hex characters.
export const TXID_HEX_REGEX = /^[0-9a-fA-F]{64}$/

// OP_1..OP_16 encode small integers as (opcode - OP_N_VALUE_OFFSET).
export const OP_N_VALUE_OFFSET = 80
// Smallest multisig script: OP_m <pubkey> OP_CHECKMULTISIG.
export const MIN_MULTISIG_SCRIPT_LENGTH = 3
