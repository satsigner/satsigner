/** Matches the `[fingerprint/...]` or `[fingerprint]` key origin prefix. */
export const KEY_ORIGIN_FINGERPRINT_PATTERN = /\[([0-9a-fA-F]{8})[/\]]/

/** Base58 tail can omit 0/O/I/l but BDK may emit other encodings, so match broadly. */
export const EXTENDED_PUBKEY_PATTERN = '([xyztuv]pub)[A-Za-z0-9]+'
