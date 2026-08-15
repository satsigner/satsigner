export const SATS_PER_BITCOIN = 100_000_000
// Default Bitcoin P2P protocol port on mainnet.
export const MAINNET_P2P_PORT = 8333
export const MILLISATS_PER_SAT = 1000
export const DUST_LIMIT = 546
export const RECOMMENDED_BASE_FEE = 256
export const UNUSED_INTERNAL_ADDRESSES_NEEDED = 3

// BIP141: 1 non-witness byte = 4 weight units, 1 witness byte = 1 weight unit.
// vsize = ceil(weight / WITNESS_SCALE_FACTOR).
export const WITNESS_SCALE_FACTOR = 4

// BIP174 PSBT magic bytes ("psbt" + 0xff separator), hex-encoded.
export const PSBT_MAGIC_HEX = '70736274ff'
