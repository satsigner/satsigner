import { UR, URDecoder, UREncoder } from '@ngraveio/bc-ur'
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
function decodeBase32ToHex(base32Data: string): string {
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

      // Extract raw transaction from PSBT for consistent UI behavior with BBQR
      return extractRawTransactionFromPSBT(psbtHex)
    } else {
      throw new Error('UR decoder not complete after receiving part')
    }
  } catch (error) {
    // Fallback: extract base32 data and decode it
    const urMatch = ur.match(/^ur:crypto-psbt\/(.+)$/i)
    if (urMatch) {
      const base32Data = urMatch[1]
      try {
        const hexData = decodeBase32ToHex(base32Data)
        return extractRawTransactionFromPSBT(hexData)
      } catch (_base32Error) {
        // Return the base32 data as last resort for debugging
        return base32Data
      }
    }

    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to decode UR to PSBT: ${message}`)
  }
}

export function decodeMultiPartURToPSBT(urFragments: string[]): string {
  try {
    // Use URDecoder for proper multi-part UR parsing
    const decoder = new URDecoder()

    // Feed all fragments to the decoder
    for (const fragment of urFragments) {
      decoder.receivePart(fragment)
    }

    if (decoder.isComplete()) {
      const result = decoder.resultUR()
      const cborData = result.cbor
      const psbtBytes = parseCBORByteString(new Uint8Array(cborData))
      const psbtHex = Buffer.from(Array.from(psbtBytes)).toString('hex')

      // Extract raw transaction from PSBT for consistent UI behavior with BBQR
      return extractRawTransactionFromPSBT(psbtHex)
    } else {
      // Fallback: concatenate base32 data parts and decode
      const dataParts = urFragments
        .map((fragment) => {
          const urMatch = fragment.match(/^ur:crypto-psbt\/\d+-\d+\/(.+)$/i)
          return urMatch ? urMatch[1] : ''
        })
        .filter((part) => part.length > 0)

      const concatenatedBase32 = dataParts.join('')

      try {
        const hexData = decodeBase32ToHex(concatenatedBase32)
        return extractRawTransactionFromPSBT(hexData)
      } catch (_base32Error) {
        return concatenatedBase32
      }
    }
  } catch (_error) {
    // Fallback to simple concatenation and base32 decode in case of any error
    const dataParts = urFragments
      .map((fragment) => {
        const urMatch = fragment.match(/^ur:crypto-psbt\/\d+-\d+\/(.+)$/i)
        return urMatch ? urMatch[1] : ''
      })
      .filter((part) => part.length > 0)

    const concatenatedBase32 = dataParts.join('')

    try {
      const hexData = decodeBase32ToHex(concatenatedBase32)
      return extractRawTransactionFromPSBT(hexData)
    } catch (_base32Error) {
      return concatenatedBase32
    }
  }
}

/**
 * Extract raw transaction from PSBT data
 * PSBT contains the raw transaction plus additional signing data
 * We want to extract just the raw transaction for display consistency with BBQR
 */
function extractRawTransactionFromPSBT(psbtHex: string): string {
  try {
    // PSBT format: magic bytes (4) + separator (1) + global map + input maps + output maps + separator (1)
    // We need to find the raw transaction in the global map

    if (!psbtHex.toLowerCase().startsWith('70736274ff')) {
      // Not a PSBT, return as-is
      return psbtHex
    }

    // Skip magic bytes (70736274) and separator (ff)
    let offset = 10 // 5 bytes * 2 chars each

    // Parse global map to find raw transaction
    while (offset < psbtHex.length) {
      if (offset + 2 > psbtHex.length) break

      const keyLen = parseInt(psbtHex.substr(offset, 2), 16)
      offset += 2

      if (keyLen === 0) {
        // End of global map
        break
      }

      if (offset + keyLen * 2 > psbtHex.length) break

      const key = psbtHex.substr(offset, keyLen * 2)
      offset += keyLen * 2

      if (offset + 2 > psbtHex.length) break

      const valueLen = parseInt(psbtHex.substr(offset, 2), 16)
      offset += 2

      if (offset + valueLen * 2 > psbtHex.length) break

      const value = psbtHex.substr(offset, valueLen * 2)
      offset += valueLen * 2

      // Key type 0x00 contains the raw transaction
      if (key === '00') {
        return value
      }
    }

    return psbtHex
  } catch (_error) {
    return psbtHex
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
        `CBOR length mismatch: expected ${length} bytes, got ${cborData.length - offset}`
      )
    }

    const result = cborData.slice(offset, offset + length)

    return result
  }

  // Handle other CBOR types that might contain the PSBT
  throw new Error(
    `Unsupported CBOR major type: ${(firstByte & 0xe0) >> 5} (byte: 0x${firstByte.toString(16)})`
  )
}
