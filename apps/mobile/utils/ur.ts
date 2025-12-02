import { UR, URDecoder, UREncoder } from '@ngraveio/bc-ur'
import { Buffer } from 'buffer'

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
  try {
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
    for (let i = 0; i < encoder.fragments.length; i++) {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to generate UR fragments: ${message}`)
  }
}

export function decodeURToPSBT(ur: string): string {
  try {
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
      } else {
        return psbtHex
      }
    } else {
      throw new Error('UR decoder not complete after receiving part')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to decode UR to PSBT: ${message}`)
  }
}

/**
 * Generic UR decoder that can handle any UR type (BYTES, CRYPTO-PSBT, etc.)
 * Returns the raw decoded data as a string
 */
function isCBORByteStringLike(cborData: Uint8Array): boolean {
  if (cborData.length < 2) {
    return false
  }

  const firstByte = cborData[0]

  if ((firstByte & 0xe0) !== 0x40) {
    return false
  }

  if (firstByte < 0x58) {
    const length = firstByte & 0x1f
    return 1 + length <= cborData.length
  }

  if (firstByte === 0x58 && cborData.length >= 2) {
    const length = cborData[1]
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

  const result = decoder.resultUR()
  const cborData = result.cbor
  const cborBytes = new Uint8Array(cborData)

  if (result.type === 'bytes') {
    const decodedString = isCBORByteStringLike(cborBytes)
      ? Buffer.from(parseCBORByteString(cborBytes)).toString('utf-8')
      : Buffer.from(cborBytes).toString('utf-8')

    return normalizeCashuTokenString(decodedString)
  }

  if (isCBORByteStringLike(cborBytes)) {
    const parsedBytes = parseCBORByteString(cborBytes)
    const hexResult = Buffer.from(Array.from(parsedBytes)).toString('hex')
    return hexResult
  }

  const hexResult = Buffer.from(Array.from(cborData)).toString('hex')
  return hexResult
}

export async function decodeMultiPartURToPSBT(
  urFragments: string[]
): Promise<string> {
  try {
    // Use URDecoder for proper multi-part UR parsing
    const decoder = new URDecoder()

    // Sort fragments by sequence number first (following Java implementation pattern)
    // Use a more memory-efficient sorting approach
    const sortedFragments = urFragments.sort((a, b) => {
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
        await new Promise((resolve) => setTimeout(resolve, 1))
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
      progress >= 1.0

    if (shouldTryDecoding) {
      try {
        const result = decoder.resultUR()
        if (result && result.cbor) {
          const cborData = result.cbor
          const psbtBytes = parseCBORByteString(new Uint8Array(cborData))
          const psbtHex = Buffer.from(Array.from(psbtBytes)).toString('hex')

          // For UR format, return the PSBT hex directly instead of trying to extract final transaction
          // This ensures we preserve all the witness data and signatures
          if (psbtHex.toLowerCase().startsWith('70736274')) {
            return psbtHex
          } else {
            return psbtHex
          }
        }
      } catch (_resultError) {
        // Continue to error handling
      }
    }

    // If we get here, the decoder isn't ready yet
    if (progress < 0.3) {
      throw new Error(
        `UR decoder needs more fragments: ${Math.round(
          progress * 100
        )}% complete`
      )
    } else if (progress < 0.8) {
      throw new Error(
        `UR decoder needs more fragments: ${Math.round(
          progress * 100
        )}% complete (fountain encoding requires more fragments)`
      )
    } else {
      // Try to force extraction even if not 100% complete
      try {
        const result = decoder.resultUR()
        if (result && result.cbor) {
          const cborData = result.cbor
          const psbtBytes = parseCBORByteString(new Uint8Array(cborData))
          const psbtHex = Buffer.from(Array.from(psbtBytes)).toString('hex')

          if (psbtHex.toLowerCase().startsWith('70736274')) {
            return psbtHex
          } else {
            return psbtHex
          }
        }
      } catch (_forceError) {
        // Continue to final error
      }

      throw new Error(
        `UR decoder not ready: ${Math.round(progress * 100)}% complete`
      )
    }
  } catch (error) {
    throw new Error(
      `UR decoding failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

function processURGenericBytes(cborData: Uint8Array) {
  const parsedBytes = parseCBORByteString(cborData)
  const decodedString = Buffer.from(parsedBytes).toString('utf-8')

  if (decodedString.includes('cashuA') || decodedString.includes('cashuB')) {
    return decodedString.replace(/[^\x20-\x7E]/g, '').trim()
  }

  return decodedString
}

function processURGenericResult(result: UR) {
  if (!result || !result.cbor) {
    throw new Error('UR decoder result is invalid')
  }

  const cborData = new Uint8Array(result.cbor)

  if (result.type === 'bytes') {
    return processURGenericBytes(cborData)
  }

  const parsedBytes = parseCBORByteString(cborData)
  return Buffer.from(Array.from(parsedBytes)).toString('hex')
}

export function decodeMultiPartURGeneric(urFragments: string[]): string {
  const decoder = new URDecoder()

  const sortedFragments = urFragments.sort((a, b) => {
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
    progress >= 1.0

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

  const firstByte = cborData[0]

  // Handle major type 2 (byte strings)
  if ((firstByte & 0xe0) === 0x40) {
    let offset = 1
    let length = 0

    if (firstByte < 0x58) {
      // Short byte string: length in first byte (0-23)
      length = firstByte & 0x1f
    } else if (firstByte === 0x58) {
      // 1-byte length follows
      if (cborData.length < 2)
        throw new Error('CBOR truncated at 1-byte length')
      length = cborData[1]
      offset = 2
    } else if (firstByte === 0x59) {
      // 2-byte length follows (big endian)
      if (cborData.length < 3)
        throw new Error('CBOR truncated at 2-byte length')
      length = (cborData[1] << 8) | cborData[2]
      offset = 3
    } else if (firstByte === 0x5a) {
      // 4-byte length follows (big endian)
      if (cborData.length < 5)
        throw new Error('CBOR truncated at 4-byte length')
      length =
        (cborData[1] << 24) |
        (cborData[2] << 16) |
        (cborData[3] << 8) |
        cborData[4]
      offset = 5
    } else if (firstByte === 0x5b) {
      // 8-byte length follows (big endian) - needed for larger PSBTs
      if (cborData.length < 9)
        throw new Error('CBOR truncated at 8-byte length')

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
