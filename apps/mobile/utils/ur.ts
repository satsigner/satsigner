import { Buffer } from 'buffer'

import { UR, URDecoder, UREncoder } from '@ngraveio/bc-ur'

/**
 * Manually create CBOR-encoded crypto-psbt UR data
 * This avoids issues with the @ngraveio/bc-ur library's automatic CBOR encoding
 * that causes UnicodeDecodeError on SeedSigner devices
 */
function createCryptoPsbtCBOR(psbtBytes: Buffer): Uint8Array {
  // According to the crypto-psbt specification, we need to create a CBOR byte string
  // The format is: CBOR byte string tag + length + data

  const dataLength = psbtBytes.length

  let cborHeader: number[]

  if (dataLength < 24) {
    // Short byte string: 0x40 + length
    cborHeader = [0x40 + dataLength]
  } else if (dataLength < 256) {
    // Byte string with 1-byte length: 0x58 + length byte
    cborHeader = [0x58, dataLength]
  } else if (dataLength < 65536) {
    // Byte string with 2-byte length: 0x59 + length bytes (big endian)
    cborHeader = [0x59, (dataLength >> 8) & 0xff, dataLength & 0xff]
  } else {
    // Byte string with 4-byte length: 0x5A + length bytes (big endian)
    cborHeader = [
      0x5a,
      (dataLength >> 24) & 0xff,
      (dataLength >> 16) & 0xff,
      (dataLength >> 8) & 0xff,
      dataLength & 0xff
    ]
  }

  const cborData = new Uint8Array(cborHeader.length + psbtBytes.length)
  cborData.set(cborHeader, 0)
  cborData.set(psbtBytes, cborHeader.length)

  return cborData
}

export function getURFragmentsFromPSBT(
  psbt: string,
  format: 'base64' | 'hex' = 'hex',
  fragmentSize = 400 // Smaller fragments for better camera compatibility
): string[] {
  if (!psbt || psbt.trim() === '') {
    throw new Error('PSBT input is empty or null')
  }

  const psbtBytes = Buffer.from(psbt, format)
  if (psbtBytes.length === 0) {
    throw new Error('Empty PSBT data after parsing')
  }

  // Create manual CBOR structure to avoid @ngraveio/bc-ur library encoding issues
  const cborData = createCryptoPsbtCBOR(psbtBytes)

  // Create UR directly with the manually crafted CBOR data
  const ur = new UR(Buffer.from(Array.from(cborData)), 'crypto-psbt')

  // Use appropriate fragment size for reliable camera scanning
  const finalFragmentSize = fragmentSize // Use the specified fragment size for multiple chunks

  const encoder = new UREncoder(ur, finalFragmentSize)

  const fragments: string[] = []
  for (let i = 0; i < encoder.fragments.length; i += 1) {
    const fragment = encoder.nextPart()

    if (!fragment.toLowerCase().startsWith('ur:crypto-psbt/')) {
      throw new Error(
        `Invalid UR fragment at index ${i}: ${fragment.substring(0, 100)}`
      )
    }

    // Convert to uppercase to match SeedSigner expected format (like Sparrow example)
    const uppercaseFragment = fragment.toUpperCase()
    fragments.push(uppercaseFragment)
  }

  if (fragments.length === 0) {
    throw new Error('No fragments were generated')
  }

  return fragments
}

/**
 * Encode a plain UTF-8 string (e.g. a Cashu token, BOLT11 invoice, descriptor)
 * as UR:bytes fountain fragments. Fragment size is the maximum payload bytes
 * per fragment before base32 expansion; tune to fit your QR density.
 *
 * Returns a factory that produces consecutive fragments when called repeatedly.
 * For static rendering, call `nextPart()` for each animation tick. Fountain
 * encoding automatically wraps past the last linear index and starts emitting
 * XOR'd parity parts, so the receiver can finalize without seeing every index.
 */
export function createURBytesEncoder(payload: string, fragmentSize = 200) {
  if (!payload) {
    throw new Error('Empty payload for UR bytes encoder')
  }

  const payloadBytes = Buffer.from(payload, 'utf8')
  // CBOR-encode the UTF-8 bytes as a CBOR byte string. This matches what
  // `decodeURGeneric`/`processURGenericBytes` expects for `ur:bytes`.
  const cborData = createCryptoPsbtCBOR(payloadBytes)
  const ur = new UR(Buffer.from(Array.from(cborData)), 'bytes')
  const encoder = new UREncoder(ur, Math.max(20, fragmentSize))

  return {
    nextPart(): string {
      return encoder.nextPart().toUpperCase()
    },
    totalPartCount: encoder.fragments.length
  }
}

/**
 * Generate a static list of UR:bytes fragments (single pass, no fountain
 * parity). Useful when you want to render a fixed-length animation cycle.
 */
export function getURBytesFragments(
  payload: string,
  fragmentSize = 200
): string[] {
  const encoder = createURBytesEncoder(payload, fragmentSize)
  const fragments: string[] = []
  for (let i = 0; i < encoder.totalPartCount; i += 1) {
    fragments.push(encoder.nextPart())
  }
  if (fragments.length === 0) {
    throw new Error('No UR fragments produced')
  }
  return fragments
}

export function decodeURToPSBT(ur: string): string {
  // Try using URDecoder for proper UR parsing
  const decoder = new URDecoder()
  decoder.receivePart(ur)

  if (decoder.isComplete()) {
    const result = decoder.resultUR()
    const cborData = result.cbor
    const psbtBytes = parseCBORByteString(new Uint8Array(cborData))
    const psbtHex = Buffer.from(Array.from(psbtBytes)).toString('hex')

    // For UR format, return the PSBT hex directly instead of trying to extract final transaction
    // This ensures we preserve all the witness data and signatures
    if (psbtHex.toLowerCase().startsWith('70736274')) {
      return psbtHex
    }
    return psbtHex
  }
  throw new Error('UR decoder not complete after receiving part')
}

/**
 * Generic UR decoder that can handle any UR type (BYTES, CRYPTO-PSBT, etc.)
 */
function isCBORByteStringLike(cborData: Uint8Array): boolean {
  if (cborData.length < 2) {
    return false
  }

  const [firstByte] = cborData

  if ((firstByte & 0xe0) !== 0x40) {
    return false
  }

  if (firstByte < 0x58) {
    const length = firstByte & 0x1f
    return 1 + length <= cborData.length
  }

  if (firstByte === 0x58 && cborData.length >= 2) {
    const [, length] = cborData
    return 2 + length <= cborData.length
  }

  if (firstByte === 0x59 && cborData.length >= 3) {
    const length = (cborData[1] << 8) | cborData[2]
    return 3 + length <= cborData.length
  }

  if (firstByte === 0x5a && cborData.length >= 5) {
    const length =
      (cborData[1] << 24) |
      (cborData[2] << 16) |
      (cborData[3] << 8) |
      cborData[4]

    return 5 + length <= cborData.length
  }

  if (firstByte === 0x5b && cborData.length >= 9) {
    const high =
      (cborData[1] << 24) |
      (cborData[2] << 16) |
      (cborData[3] << 8) |
      cborData[4]
    const low =
      (cborData[5] << 24) |
      (cborData[6] << 16) |
      (cborData[7] << 8) |
      cborData[8]

    return high === 0 && 9 + low <= cborData.length
  }

  return false
}

function normalizeCashuTokenString(decodedString: string): string {
  if (decodedString.includes('cashuA') || decodedString.includes('cashuB')) {
    return decodedString.replace(/[^\x20-\x7E]/g, '').trim()
  }

  return decodedString
}

export function decodeURGeneric(ur: string) {
  const decoder = new URDecoder()
  decoder.receivePart(ur)

  if (!decoder.isComplete()) {
    throw new Error('UR decoder not complete after receiving part')
  }

  return processURGenericResult(decoder.resultUR())
}

/**
 * Streaming UR decoder that keeps a single URDecoder instance alive across
 * multiple QR frames. Use this in scanners so fountain-encoded sequences can
 * accumulate parity across scans instead of restarting on every frame.
 */
export type URStreamDecoder = {
  /** Feed a raw UR fragment. Returns true if the fragment was accepted. */
  receivePart: (fragment: string) => boolean
  /** Estimated completion in [0, 1]. */
  progress: () => number
  /** True once the decoder has enough fragments to reconstruct the payload. */
  isComplete: () => boolean
  /**
   * Returns the decoded payload when complete, or null otherwise. For
   * `bytes` UR types the result is a UTF-8 string (typical for cashu tokens,
   * BOLT11 invoices, descriptors, etc.). For binary payloads (e.g.
   * `crypto-psbt`) the result is a hex-encoded string.
   */
  result: () => string | null
  /** Detected UR type (e.g. "bytes", "crypto-psbt"), or null before any part. */
  type: () => string | null
  /** Expected sequence length from the first fragment, or 0 if unknown. */
  expectedPartCount: () => number
  /** Number of unique indices successfully received. */
  receivedPartCount: () => number
  /** Drop all accumulated state. */
  reset: () => void
}

export function createURStreamDecoder(): URStreamDecoder {
  let decoder = new URDecoder()
  let urType: string | null = null
  let expectedParts = 0
  const receivedIndices = new Set<number>()

  function parseHeader(fragment: string) {
    const match = fragment.match(/^ur:([^/]+)\/(?:(\d+)-(\d+)\/)?/i)
    if (!match) {
      return
    }
    const [, typeStr, seqStr, totalStr] = match
    if (!urType) {
      urType = typeStr.toLowerCase()
    }
    if (seqStr && totalStr) {
      const seq = parseInt(seqStr, 10)
      const total = parseInt(totalStr, 10)
      if (!Number.isNaN(seq)) {
        receivedIndices.add(seq)
      }
      if (!Number.isNaN(total) && total > expectedParts) {
        expectedParts = total
      }
    } else {
      expectedParts = Math.max(expectedParts, 1)
      receivedIndices.add(1)
    }
  }

  return {
    expectedPartCount() {
      return expectedParts
    },
    isComplete() {
      try {
        return decoder.isComplete() === true
      } catch {
        return false
      }
    },
    progress() {
      try {
        const p = decoder.estimatedPercentComplete()
        if (typeof p === 'number' && !Number.isNaN(p)) {
          return p
        }
      } catch {
        /* ignore */
      }
      if (expectedParts > 0) {
        return Math.min(1, receivedIndices.size / expectedParts)
      }
      return 0
    },
    receivePart(fragment: string) {
      parseHeader(fragment)
      try {
        return decoder.receivePart(fragment) ?? false
      } catch {
        return false
      }
    },
    receivedPartCount() {
      return receivedIndices.size
    },
    reset() {
      decoder = new URDecoder()
      urType = null
      expectedParts = 0
      receivedIndices.clear()
    },
    result() {
      try {
        if (!decoder.isComplete()) {
          return null
        }
        const ur = decoder.resultUR()
        if (!ur || !ur.cbor) {
          return null
        }
        return processURGenericResult(ur)
      } catch {
        return null
      }
    },
    type() {
      return urType
    }
  }
}

export async function decodeMultiPartURToPSBT(
  urFragments: string[]
): Promise<string> {
  // Use URDecoder for proper multi-part UR parsing
  const decoder = new URDecoder()

  // Sort fragments by sequence number first (following Java implementation pattern)
  // Use a more memory-efficient sorting approach
  const sortedFragments = urFragments.toSorted((a, b) => {
    // Extract sequence number from fragments like "UR:CRYPTO-PSBT/881-13/..."
    const aMatch = a.match(/ur:crypto-psbt\/(\d+)-(\d+)\//i)
    const bMatch = b.match(/ur:crypto-psbt\/(\d+)-(\d+)\//i)

    if (aMatch && bMatch) {
      const aSeq = parseInt(aMatch[1], 10)
      const bSeq = parseInt(bMatch[1], 10)
      return aSeq - bSeq
    }

    return 0
  })

  // Feed all fragments to the decoder in sequence order
  // Process in smaller batches to reduce memory pressure
  const batchSize = 10
  for (let i = 0; i < sortedFragments.length; i += batchSize) {
    const batch = sortedFragments.slice(i, i + batchSize)

    for (const fragment of batch) {
      const success = decoder.receivePart(fragment)

      if (!success) {
        continue
      }
    }
    if (i + batchSize < sortedFragments.length) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1)
      })
    }
  }

  // For fountain encoding, check if decoder is actually complete, not just the expected fragment count
  const isDecoderComplete = decoder.isComplete()
  const progress = decoder.estimatedPercentComplete()

  // Try to get result even if isComplete() returns undefined or false
  // Some UR implementations complete at different thresholds
  const shouldTryDecoding =
    isDecoderComplete === true ||
    (isDecoderComplete === undefined && progress > 0.9) ||
    progress >= 1

  if (shouldTryDecoding) {
    const result = decoder.resultUR()
    if (result && result.cbor) {
      const cborData = result.cbor
      const psbtBytes = parseCBORByteString(new Uint8Array(cborData))
      const psbtHex = Buffer.from(Array.from(psbtBytes)).toString('hex')

      // For UR format, return the PSBT hex directly instead of trying to extract final transaction
      // This ensures we preserve all the witness data and signatures
      if (psbtHex.toLowerCase().startsWith('70736274')) {
        return psbtHex
      }
      return psbtHex
    }
  }

  // If we get here, the decoder isn't ready yet
  if (progress < 0.8) {
    throw new Error(
      `UR decoder needs more fragments: ${Math.round(progress * 100)}% complete`
    )
  }

  // Try to force extraction even if not 100% complete
  const result = decoder.resultUR()
  if (result && result.cbor) {
    const cborData = result.cbor
    const psbtBytes = parseCBORByteString(new Uint8Array(cborData))
    const psbtHex = Buffer.from(Array.from(psbtBytes)).toString('hex')

    if (psbtHex.toLowerCase().startsWith('70736274')) {
      return psbtHex
    }
    return psbtHex
  }

  throw new Error('UR decoder failed')
}

function processURGenericBytes(cborData: Uint8Array) {
  const decodedString = isCBORByteStringLike(cborData)
    ? Buffer.from(parseCBORByteString(cborData)).toString('utf8')
    : Buffer.from(cborData).toString('utf8')

  return normalizeCashuTokenString(decodedString)
}

function processURGenericResult(result: UR) {
  if (!result || !result.cbor) {
    throw new Error('UR decoder result is invalid')
  }

  const cborData = new Uint8Array(result.cbor)

  if (result.type === 'bytes') {
    return processURGenericBytes(cborData)
  }

  if (isCBORByteStringLike(cborData)) {
    const parsedBytes = parseCBORByteString(cborData)
    return Buffer.from(Array.from(parsedBytes)).toString('hex')
  }

  return Buffer.from(Array.from(cborData)).toString('hex')
}

export function decodeMultiPartURGeneric(urFragments: string[]): string {
  const decoder = new URDecoder()

  const sortedFragments = urFragments.toSorted((a, b) => {
    const aMatch = a.match(/ur:([^/]+)\/(\d+)-(\d+)\//i)
    const bMatch = b.match(/ur:([^/]+)\/(\d+)-(\d+)\//i)

    if (aMatch && bMatch) {
      const aSeq = parseInt(aMatch[2], 10)
      const bSeq = parseInt(bMatch[2], 10)
      return aSeq - bSeq
    }

    return 0
  })

  const batchSize = 10
  for (let i = 0; i < sortedFragments.length; i += batchSize) {
    const batch = sortedFragments.slice(i, i + batchSize)

    for (const fragment of batch) {
      decoder.receivePart(fragment)
    }
  }

  const isDecoderComplete = decoder.isComplete()
  const progress = decoder.estimatedPercentComplete()

  const shouldTryDecoding =
    isDecoderComplete === true ||
    (isDecoderComplete === undefined && progress > 0.9) ||
    progress >= 1

  if (shouldTryDecoding) {
    const result = decoder.resultUR()
    return processURGenericResult(result)
  }

  if (progress < 0.3) {
    throw new Error(
      `UR decoder needs more fragments: ${Math.round(progress * 100)}% complete`
    )
  }

  if (progress < 0.8) {
    throw new Error(
      `UR decoder needs more fragments: ${Math.round(
        progress * 100
      )}% complete (fountain encoding requires more fragments)`
    )
  }

  const result = decoder.resultUR()
  return processURGenericResult(result)
}

/**
 * Parse CBOR byte string to extract the raw PSBT bytes
 * This reverses the manual CBOR encoding we do in createCryptoPsbtCBOR
 * Based on Bitcoin Keeper implementation for handling UR CBOR structure
 */
function parseCBORByteString(cborData: Uint8Array): Uint8Array {
  if (cborData.length < 2) {
    throw new Error('CBOR data too short')
  }

  const [firstByte] = cborData

  // Handle major type 2 (byte strings)
  if ((firstByte & 0xe0) === 0x40) {
    let offset = 1
    let length = 0

    if (firstByte < 0x58) {
      // Short byte string: length in first byte (0-23)
      length = firstByte & 0x1f
    } else if (firstByte === 0x58) {
      // 1-byte length follows
      if (cborData.length < 2) {
        throw new Error('CBOR truncated at 1-byte length')
      }
      ;[, length] = cborData
      offset = 2
    } else if (firstByte === 0x59) {
      // 2-byte length follows (big endian)
      if (cborData.length < 3) {
        throw new Error('CBOR truncated at 2-byte length')
      }
      length = (cborData[1] << 8) | cborData[2]
      offset = 3
    } else if (firstByte === 0x5a) {
      // 4-byte length follows (big endian)
      if (cborData.length < 5) {
        throw new Error('CBOR truncated at 4-byte length')
      }
      length =
        (cborData[1] << 24) |
        (cborData[2] << 16) |
        (cborData[3] << 8) |
        cborData[4]
      offset = 5
    } else if (firstByte === 0x5b) {
      // 8-byte length follows (big endian) - needed for larger PSBTs
      if (cborData.length < 9) {
        throw new Error('CBOR truncated at 8-byte length')
      }

      // JavaScript safe integer limit is 2^53-1, so we'll handle first 4 bytes as high part
      const high =
        (cborData[1] << 24) |
        (cborData[2] << 16) |
        (cborData[3] << 8) |
        cborData[4]
      const low =
        (cborData[5] << 24) |
        (cborData[6] << 16) |
        (cborData[7] << 8) |
        cborData[8]

      if (high > 0) {
        throw new Error(`CBOR length too large: high=${high}, low=${low}`)
      }

      length = low
      offset = 9
    } else {
      throw new Error(
        `Unsupported CBOR byte string format: 0x${firstByte.toString(16)}`
      )
    }

    if (offset + length > cborData.length) {
      throw new Error(
        `CBOR length mismatch: expected ${length} bytes, got ${
          cborData.length - offset
        }`
      )
    }

    const result = cborData.slice(offset, offset + length)

    return result
  }

  // Handle other CBOR types that might contain the PSBT
  throw new Error(
    `Unsupported CBOR major type: ${
      (firstByte & 0xe0) >> 5
    } (byte: 0x${firstByte.toString(16)})`
  )
}
