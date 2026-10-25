import { opcodes } from 'bitcoinjs-lib'

export const SATS_PER_BITCOIN = 100_000_000
export const BTC_DECIMALS = 8
export const ZERO_BTC_LABEL = (0).toFixed(BTC_DECIMALS)
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
// BIP125: a transaction signals replaceability when any input sequence is
// below 0xfffffffe.
export const BIP125_REPLACEABLE_SEQUENCE_BELOW = 0xff_ff_ff_fe
// Bitcoin Core default incremental relay fee: 1 sat/vB on the replacement size.
export const INCREMENTAL_RELAY_FEE_RATE = 1
export const UNUSED_INTERNAL_ADDRESSES_NEEDED = 3

export const P2PKH_SCRIPT_BYTES = 25
export const P2SH_SCRIPT_BYTES = 23
export const P2WPKH_SCRIPT_BYTES = 22
export const P2WPKH_PROGRAM_BYTES = 20
export const P2WSH_SCRIPT_BYTES = 34
export const P2WSH_PROGRAM_BYTES = 32
export const P2TR_SCRIPT_BYTES = 34
export const P2TR_PROGRAM_BYTES = 32

// OP_1..OP_16 encode small integers as opcode - OP_N_OFFSET.
export const OP_N_OFFSET = opcodes.OP_1 - 1
export const MIN_PARTIAL_SIGNATURE_BYTES = 64
export const MAX_PARTIAL_SIGNATURE_BYTES = 72

// BIP141: 1 non-witness byte = 4 weight units, 1 witness byte = 1 weight unit.
// vsize = ceil(weight / WITNESS_SCALE_FACTOR).
export const WITNESS_SCALE_FACTOR = 4
export const VBYTES_PER_KVB = 1000

// Base transaction size (version + locktime).
export const LEGACY_TX_BASE_BYTES = 10
// Outpoint[36] + script[~108] + sequence[4].
export const LEGACY_INPUT_BYTES = 148
// Value[8] + script[~26].
export const LEGACY_OUTPUT_BYTES = 34

// BIP174 PSBT magic bytes ("psbt" + 0xff separator), hex-encoded.
export const PSBT_MAGIC_HEX = '70736274ff'

// BIP174 PSBT magic bytes as they appear at the start of a base64 PSBT.
export const PSBT_MAGIC_BASE64 = 'cHNidP'

// OP_m <pubkey> OP_n OP_CHECKMULTISIG
export const MIN_MULTISIG_SCRIPT_CHUNKS = 4
export const BITCOIN_URI_SCHEME = 'bitcoin:'
// Output amount placeholder the user fills in on ioPreview.
export const UNSET_OUTPUT_AMOUNT_SATS = 1
export const MIN_TYPED_ADDRESS_LENGTH_TO_VALIDATE = 10
export const BARE_BITCOIN_ADDRESS_PATTERN = /^[a-zA-Z0-9]{26,62}$/
export const HEX_PATTERN = /^[0-9a-fA-F]+$/
