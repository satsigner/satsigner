const EXTRA_ENTROPY_SIZE = 32
const LOW_R_MASK = 0x7f

/**
 * "Extra entropy" for a low-R grinding retry: a little-endian uint32
 * counter in an otherwise-zeroed 32-byte buffer, matching the convention
 * used by bitcoinjs-lib/ecpair (and, via libsecp256k1, Bitcoin Core / LND).
 */
export function lowRExtraEntropy(counter: number): Uint8Array {
  const extraEntropy = new Uint8Array(EXTRA_ENTROPY_SIZE)
  new DataView(extraEntropy.buffer).setUint32(0, counter, true)
  return extraEntropy
}

/**
 * A compact ECDSA signature is "low-R" when the top bit of its first byte
 * (the most significant byte of r) is clear, so r's DER encoding never
 * needs an extra padding byte - keeping signatures a consistent, compact
 * size instead of occasionally growing by one byte.
 */
export function isLowR(signature: Uint8Array): boolean {
  return signature[0] <= LOW_R_MASK
}
