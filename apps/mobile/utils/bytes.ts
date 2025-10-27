type Byte = number

type ByteUtils = {
  /** Convert virtual bytes to kilovirtualbytes (÷ 1,000) */
  toKilo: (vbytes: Byte) => Byte
  /** Convert virtual bytes to megavirtualbytes (÷ 1,000,000) */
  toMega: (vbytes: Byte) => Byte
  /** Convert kilovirtualbytes to virtual bytes (× 1,000) */
  fromKilo: (kvbytes: Byte) => Byte
  /** Convert megavirtualbytes to virtual bytes (× 1,000,000) */
  fromMega: (mvbytes: Byte) => Byte
  /** Convert kilovirtualbytes to megavirtualbytes (÷ 1,000) */
  kiloToMega: (kvbytes: Byte) => Byte
  /** Convert megavirtualbytes to kilovirtualbytes (× 1,000) */
  megaToKilo: (mvbytes: Byte) => Byte
}

/**
 * Utility object for Bitcoin virtual byte conversions.
 * @example
 * bytes.toKilo(1000) // 1 kB
 * bytes.toMega(1_000_000) // 1 MB
 * bytes.fromKilo(2) // 2000 B
 * bytes.fromMega(1.5) // 1,500,000 B
 */
export const bytes: ByteUtils = {
  toKilo: (bytes) => bytes / 1_000,
  toMega: (bytes) => bytes / 1_000_000,
  fromKilo: (kBytes) => kBytes * 1_000,
  fromMega: (MBytes) => MBytes * 1_000_000,
  kiloToMega: (kBytes) => kBytes / 1_000,
  megaToKilo: (MBytes) => MBytes * 1_000
}
