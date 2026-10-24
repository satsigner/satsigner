/** Matches the `[fingerprint/...]` or `[fingerprint]` key origin prefix. */
export const KEY_ORIGIN_FINGERPRINT_PATTERN = /\[([0-9a-fA-F]{8})[/\]]/

/** Base58 tail can omit 0/O/I/l but BDK may emit other encodings, so match broadly. */
export const EXTENDED_PUBKEY_PATTERN = '([xyztuv]pub)[A-Za-z0-9]+'

/** BIP-380 descriptor checksum parameters. */
export const DESCRIPTOR_CHECKSUM_INPUT_CHARSET =
  '0123456789()[],\'/*abcdefgh@:$%{}IJKLMNOPQRSTUVWXYZ&+-.;<=>?!^_|~ijklmnopqrstuvwxyzABCDEFGH`#"\\ '
export const DESCRIPTOR_CHECKSUM_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
export const DESCRIPTOR_CHECKSUM_GENERATOR = [
  0xf5_de_e5_19_89n,
  0xa9_fd_ca_33_12n,
  0x1b_ab_10_e3_2dn,
  0x37_06_b1_67_7an,
  0x64_4d_62_6f_fdn
]
export const DESCRIPTOR_CHECKSUM_LENGTH = 8
