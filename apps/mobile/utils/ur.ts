import { UR, URDecoder, UREncoder } from '@ngraveio/bc-ur'
import * as bitcoin from 'bitcoinjs-lib'
import { Buffer } from 'buffer'

export interface URData {
  type: string
  data: Uint8Array
}

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

/**
 * Simple base32 decoder for UR data
 * This is a fallback when the proper UR library fails
 */
function _decodeBase32ToHex(base32Data: string): string {
  try {
    // Base32 alphabet used by UR format
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    const base32Clean = base32Data.toUpperCase().replace(/[^A-Z2-7]/g, '')

    let bits = ''
    for (const char of base32Clean) {
      const index = alphabet.indexOf(char)
      if (index === -1) continue
      bits += index.toString(2).padStart(5, '0')
    }

    // Convert bits to bytes
    const bytes: number[] = []
    for (let i = 0; i < bits.length - 7; i += 8) {
      const byte = parseInt(bits.slice(i, i + 8), 2)
      bytes.push(byte)
    }

    // Convert to hex
    const hexResult = bytes.map((b) => b.toString(16).padStart(2, '0')).join('')

    // The hexResult is CBOR-encoded data, we need to decode it to get the actual PSBT
    try {
      const cborBytes = Buffer.from(hexResult, 'hex')
      const psbtBytes = parseCBORByteString(new Uint8Array(cborBytes))
      const psbtHex = Buffer.from(Array.from(psbtBytes)).toString('hex')
      return psbtHex
    } catch (_cborError) {
      // Check if the raw hex might already be PSBT format
      if (hexResult.toLowerCase().startsWith('70736274')) {
        return hexResult
      }
      // Return raw hex as fallback
      return hexResult
    }
  } catch (_error) {
    throw new Error('Failed to decode base32 data')
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

export function decodeMultiPartURToPSBT(urFragments: string[]): string {
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
          // Continue processing other fragments even if one fails
        }
      }

      // Allow garbage collection between batches
      if (i + batchSize < sortedFragments.length) {
        // Small delay to allow GC
        const start = Date.now()
        while (Date.now() - start < 1) {
          // Busy wait for 1ms to allow GC
        }
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

/**
 * Extract final transaction hex from PSBT data by finalizing all inputs
 * This properly handles PSBTs by finalizing them and extracting the final transaction
 */
function _extractFinalTransactionHexFromPSBT(psbtHex: string): string {
  try {
    const psbt = bitcoin.Psbt.fromHex(psbtHex)

    // Try extraction first (in case it's already finalized)
    try {
      const tx = psbt.extractTransaction()
      const txHex = tx.toHex()
      return txHex
    } catch (_directError) {
      // If direct extraction fails, try finalizing first
      try {
        // Create a new PSBT instance to avoid state issues
        const freshPsbt = bitcoin.Psbt.fromHex(psbtHex)
        freshPsbt.finalizeAllInputs()

        const tx = freshPsbt.extractTransaction()
        const txHex = tx.toHex()
        return txHex
      } catch (_finalizeError) {
        // Last resort: try manual witness extraction if this is a witness transaction
        try {
          const manualTxHex = extractWitnessTransactionFromPSBT(psbtHex)
          if (
            manualTxHex &&
            (manualTxHex.startsWith('01000000') ||
              manualTxHex.startsWith('02000000'))
          ) {
            return manualTxHex
          }
        } catch (_manualError) {
          // Continue to final error
        }

        throw _finalizeError
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to extract final transaction: ${(error as Error).message}`
    )
  }
}

/**
 * Manual extraction of witness transaction from PSBT hex
 * This is a fallback when bitcoinjs-lib extraction fails
 */
function extractWitnessTransactionFromPSBT(psbtHex: string): string {
  try {
    // PSBT format: magic(4) + separator(1) + length + global_map + input_maps + output_maps
    // We need to find and extract the witness transaction

    if (!psbtHex.toLowerCase().startsWith('70736274ff')) {
      throw new Error('Not a valid PSBT (missing magic bytes)')
    }

    // Skip PSBT header: 70736274ff (5 bytes)
    const offset = 10 // 5 bytes * 2 hex chars

    // Skip global map length and data
    // This is a simplified approach - in reality we'd need to parse the full PSBT structure
    // But for now, let's try to find the transaction data after the PSBT header

    // Look for transaction version (01000000 or 02000000) after the PSBT header
    for (let i = offset; i < psbtHex.length - 16; i += 2) {
      const potential = psbtHex.substring(i, i + 16).toLowerCase()
      if (
        potential.startsWith('01000000') ||
        potential.startsWith('02000000')
      ) {
        // Try to extract from this point to the end
        const remainingHex = psbtHex.substring(i)

        // Use the full remaining hex to preserve all transaction data
        // This ensures we don't cut off essential witness/signature data
        if (remainingHex.length >= 60) {
          return remainingHex
        }
      }
    }

    throw new Error('No valid transaction data found in PSBT')
  } catch (error) {
    throw new Error(`Manual extraction failed: ${(error as Error).message}`)
  }
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
