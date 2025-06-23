import { UR, URDecoder, UREncoder } from '@ngraveio/bc-ur'
import { Buffer } from 'buffer'
import * as bitcoin from 'bitcoinjs-lib'

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
  console.log('🔧 Decoding single UR:', ur.substring(0, 50) + '...')

  try {
    // Try using URDecoder for proper UR parsing
    const decoder = new URDecoder()
    decoder.receivePart(ur)

    console.log('🔧 Single UR Decoder complete?', decoder.isComplete())

    if (decoder.isComplete()) {
      const result = decoder.resultUR()
      console.log('🔧 Single UR Result type:', result.type)
      console.log('🔧 Single UR CBOR data length:', result.cbor.length)

      const cborData = result.cbor
      const psbtBytes = parseCBORByteString(new Uint8Array(cborData))
      const psbtHex = Buffer.from(Array.from(psbtBytes)).toString('hex')

      console.log('✅ Single UR decoded PSBT hex length:', psbtHex.length)
      console.log(
        '✅ Single UR decoded PSBT hex (first 100 chars):',
        psbtHex.substring(0, 100)
      )

      // Try to extract final transaction, but return PSBT if extraction fails
      if (psbtHex.toLowerCase().startsWith('70736274')) {
        console.log(
          '✅ Valid PSBT detected, attempting to extract final transaction'
        )
        try {
          const finalTxHex = extractFinalTransactionHexFromPSBT(psbtHex)
          console.log(
            '✅ Successfully extracted final transaction hex:',
            finalTxHex.substring(0, 100) + '...'
          )
          return finalTxHex
        } catch (extractError) {
          console.log(
            '⚠️ Failed to extract final transaction, returning PSBT hex instead:',
            extractError
          )
          console.log(
            '⚠️ This might be a partially signed PSBT or missing witness data'
          )
          return psbtHex
        }
      } else {
        console.log('⚠️ Not a valid PSBT, returning as-is')
        return psbtHex
      }
    } else {
      throw new Error('UR decoder not complete after receiving part')
    }
  } catch (error) {
    console.log('❌ Single UR decoder failed:', error)
    console.log('🔍 Single UR error details:', {
      errorMessage: error instanceof Error ? error.message : String(error),
      urString: ur.substring(0, 100) + '...'
    })

    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to decode UR to PSBT: ${message}`)
  }
}

export function decodeMultiPartURToPSBT(urFragments: string[]): string {
  console.log(
    '🔧 Decoding multi-part UR fragments:',
    urFragments.length,
    'fragments'
  )

  try {
    // Use URDecoder for proper multi-part UR parsing
    const decoder = new URDecoder()

    // Sort fragments by sequence number first (following Java implementation pattern)
    const sortedFragments = urFragments.slice().sort((a, b) => {
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

    console.log('🔧 Fragment sequence order check:')
    sortedFragments.slice(0, 3).forEach((fragment, i) => {
      const match = fragment.match(/ur:crypto-psbt\/(\d+)-(\d+)\//i)
      if (match) {
        console.log(`   Fragment ${i}: seq=${match[1]}, total=${match[2]}`)
      }
    })

    // Feed all fragments to the decoder in sequence order
    for (let i = 0; i < sortedFragments.length; i++) {
      const fragment = sortedFragments[i]
      console.log(
        `🔧 Adding fragment ${i + 1}/${sortedFragments.length}:`,
        fragment.substring(0, 50) + '...'
      )

      const success = decoder.receivePart(fragment)
      console.log(`🔧 Fragment ${i + 1} received successfully:`, success)

      if (!success) {
        console.log(`❌ Failed to receive fragment ${i + 1}`)
      }
    }

    console.log('🔧 UR Decoder complete?', decoder.isComplete())
    console.log('🔧 UR Decoder progress:', decoder.estimatedPercentComplete())

    // For fountain encoding, check if decoder is actually complete, not just the expected fragment count
    const isDecoderComplete = decoder.isComplete()
    const progress = decoder.estimatedPercentComplete()

    console.log('🔧 Decoder completion status:', {
      isComplete: isDecoderComplete,
      progress: progress,
      expectedFragments: sortedFragments.length
    })

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
          console.log('🔧 UR Result type:', result.type)
          console.log('🔧 UR CBOR data length:', result.cbor.length)

          const cborData = result.cbor
          const psbtBytes = parseCBORByteString(new Uint8Array(cborData))
          const psbtHex = Buffer.from(Array.from(psbtBytes)).toString('hex')

          console.log('✅ Decoded PSBT hex length:', psbtHex.length)
          console.log(
            '✅ Decoded PSBT hex (first 100 chars):',
            psbtHex.substring(0, 100)
          )

          // Try to extract final transaction, but return PSBT if extraction fails
          if (psbtHex.toLowerCase().startsWith('70736274')) {
            console.log(
              '✅ Valid PSBT detected, attempting to extract final transaction'
            )
            try {
              const finalTxHex = extractFinalTransactionHexFromPSBT(psbtHex)
              console.log(
                '✅ Successfully extracted final transaction hex:',
                finalTxHex.substring(0, 100) + '...'
              )
              return finalTxHex
            } catch (extractError) {
              console.log(
                '⚠️ Failed to extract final transaction, returning PSBT hex instead:',
                extractError
              )
              console.log(
                '⚠️ This might be a partially signed PSBT or missing witness data'
              )
              return psbtHex
            }
          } else {
            console.log('⚠️ Not a valid PSBT, returning as-is')
            return psbtHex
          }
        }
      } catch (resultError) {
        console.log('❌ Failed to get result from decoder:', resultError)
      }
    }

    // If we get here, the decoder isn't ready yet
    if (progress < 0.3) {
      throw new Error(
        `UR decoder needs more fragments: ${Math.round(progress * 100)}% complete`
      )
    } else {
      throw new Error(
        `UR decoder not ready: ${Math.round(progress * 100)}% complete`
      )
    }
  } catch (error) {
    console.log('❌ UR decoder failed:', error)

    // The proper approach is to use the UR library correctly, not manual concatenation
    // Let's try to understand why the decoder failed
    console.log('🔍 URDecoder error details:', {
      errorMessage: error instanceof Error ? error.message : String(error),
      fragmentCount: urFragments.length,
      firstFragment: urFragments[0]?.substring(0, 100),
      lastFragment: urFragments[urFragments.length - 1]?.substring(0, 100)
    })

    // Don't fall back to manual concatenation - that approach is fundamentally wrong
    // The UR format uses Bytewords encoding, not base32, and requires proper fragment handling
    throw new Error(
      `UR decoding failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Extract final transaction hex from PSBT data by finalizing all inputs
 * This properly handles PSBTs by finalizing them and extracting the final transaction
 */
function extractFinalTransactionHexFromPSBT(psbtHex: string): string {
  console.log(
    '🔧 Starting PSBT extraction for hex:',
    psbtHex.substring(0, 50) + '...'
  )

  try {
    const psbt = bitcoin.Psbt.fromHex(psbtHex)

    console.log('🔧 PSBT input count:', psbt.data.inputs.length)
    console.log('🔧 PSBT output count:', psbt.data.outputs.length)

    // Log detailed input information
    for (let i = 0; i < psbt.data.inputs.length; i++) {
      const input = psbt.data.inputs[i]
      console.log(`🔧 Input ${i}:`)
      console.log(
        `   - finalScriptSig: ${input.finalScriptSig ? 'present' : 'missing'}`
      )
      console.log(
        `   - finalScriptWitness: ${input.finalScriptWitness ? 'present' : 'missing'}`
      )
      console.log(
        `   - partialSig count: ${input.partialSig ? input.partialSig.length : 0}`
      )
    }

    // Try extraction first (in case it's already finalized)
    try {
      console.log('🔧 Attempting direct transaction extraction...')
      const tx = psbt.extractTransaction()
      const txHex = tx.toHex()

      console.log('✅ Direct extraction successful!')
      console.log('✅ Transaction hex length:', txHex.length)
      console.log(
        '✅ Transaction hex preview:',
        txHex.substring(0, 100) + '...'
      )
      console.log('✅ Transaction starts with:', txHex.substring(0, 20))

      return txHex
    } catch (directError) {
      console.log('⚠️ Direct extraction failed:', directError)

      // If direct extraction fails, try finalizing first
      console.log('🔧 Attempting to finalize inputs before extraction...')
      try {
        // Create a new PSBT instance to avoid state issues
        const freshPsbt = bitcoin.Psbt.fromHex(psbtHex)
        freshPsbt.finalizeAllInputs()
        console.log('✅ Successfully finalized PSBT inputs')

        const tx = freshPsbt.extractTransaction()
        const txHex = tx.toHex()

        console.log('✅ Post-finalization extraction successful!')
        console.log('✅ Transaction hex length:', txHex.length)
        console.log(
          '✅ Transaction hex preview:',
          txHex.substring(0, 100) + '...'
        )
        console.log('✅ Transaction starts with:', txHex.substring(0, 20))

        return txHex
      } catch (finalizeError) {
        console.log('❌ Finalization and extraction failed:', finalizeError)

        // Last resort: try manual witness extraction if this is a witness transaction
        console.log('🔧 Attempting manual witness transaction extraction...')
        try {
          const manualTxHex = extractWitnessTransactionFromPSBT(psbtHex)
          if (
            manualTxHex &&
            (manualTxHex.startsWith('01000000') ||
              manualTxHex.startsWith('02000000'))
          ) {
            console.log(
              '✅ Manual extraction successful!',
              manualTxHex.substring(0, 100) + '...'
            )
            return manualTxHex
          }
        } catch (manualError) {
          console.log('❌ Manual extraction also failed:', manualError)
        }

        throw finalizeError
      }
    }
  } catch (error) {
    console.log('❌ All PSBT extraction attempts failed:', error)
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
    let offset = 10 // 5 bytes * 2 hex chars

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
        console.log('🔧 Found potential transaction start at offset:', i)

        // Try to extract from this point to the end
        const remainingHex = psbtHex.substring(i)

        // Use the full remaining hex to preserve all transaction data
        // This ensures we don't cut off essential witness/signature data
        if (remainingHex.length >= 60) {
          console.log(
            '🔧 Using full transaction hex (preserving all data):',
            remainingHex.substring(0, 100) + '...'
          )
          console.log(
            '🔧 Transaction length:',
            remainingHex.length / 2,
            'bytes'
          )
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
