import { UR, UREncoder } from '@ngraveio/bc-ur'
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
    const ur = new UR(Buffer.from(cborData), 'crypto-psbt')

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
  // TODO: Implement decoding if needed
  return ''
}
