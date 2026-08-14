// BIP32 hardened derivation purpose fields (the first path segment after `m/`).
// These select the address/script type a key is derived for, so a mistyped
// value here silently derives keys for the wrong wallet.
export const BIP44_PURPOSE = 44 // Legacy (P2PKH)
export const BIP45_PURPOSE = 45 // Multisig P2SH (pre-BIP48)
export const BIP48_PURPOSE = 48 // Multisig (P2SH-P2WSH / P2WSH)
export const BIP49_PURPOSE = 49 // Nested SegWit (P2SH-P2WPKH)
export const BIP84_PURPOSE = 84 // Native SegWit (P2WPKH)
export const BIP86_PURPOSE = 86 // Taproot (P2TR)

// BIP48 script_type field (4th path segment), distinguishing the two
// multisig script types sharing the m/48' purpose.
export const BIP48_SCRIPT_TYPE_P2SH_P2WSH = 1
export const BIP48_SCRIPT_TYPE_P2WSH = 2
