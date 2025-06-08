/**
 * BBQR (Better Bitcoin QR) utility functions
 * This module provides functions for creating and managing QR code chunks
 * for large binary data like PSBTs, using the official BBQR library.
 */

import {
  type FileType as OfficialFileType,
  joinQRs,
  splitQRs,
  type Version
} from './bbrq'

// Re-export the official FileType but with enum-like access for backward compatibility
export const FileType = {
  PSBT: 'P' as const,
  TXN: 'T' as const,
  JSON: 'J' as const,
  CBOR: 'C' as const,
  UNICODE: 'U' as const,
  BINARY: 'B' as const,
  EXECUTABLE: 'X' as const
} as const

// Export type for the FileType values
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type FileType = (typeof FileType)[keyof typeof FileType]

/**
 * Check if a string is a BBQR fragment
 */
export function isBBQRFragment(part: string): boolean {
  try {
    // BBQR fragments start with 'B$' followed by encoding and file type
    if (part.length < 8 || !part.startsWith('B$')) {
      return false
    }

    // Check if the header format is valid
    const encoding = part.slice(2, 3)
    const fileType = part.slice(3, 4)
    const seqTotal = part.slice(4, 6)
    const seqNumber = part.slice(6, 8)

    // Validate encoding (H, Z, or 2)
    if (!['H', 'Z', '2'].includes(encoding)) {
      return false
    }

    // Validate file type (single uppercase letter)
    if (!/^[A-Z]$/.test(fileType)) {
      return false
    }

    // Validate sequence numbers are valid base36
    const totalParts = parseInt(seqTotal, 36)
    const partNumber = parseInt(seqNumber, 36)

    if (
      isNaN(totalParts) ||
      isNaN(partNumber) ||
      totalParts < 1 ||
      partNumber >= totalParts
    ) {
      return false
    }

    return true
  } catch (_e) {
    return false
  }
}

/**
 * Create BBQR chunks from binary data
 * This function maintains backward compatibility with the original API
 */
export function createBBQRChunks(
  data: Uint8Array,
  fileType: FileType = FileType.PSBT,
  maxChunkSize: number = 400
): string[] {
  try {
    // Convert our FileType to the official library's string format
    const officialFileType = fileType as OfficialFileType

    // Calculate the target number of chunks based on maxChunkSize
    // to match the behavior of RAW PSBT and UR encoding
    let targetChunks: number
    let minSplit: number
    let maxSplit: number

    // For very large maxChunkSize (single chunk mode), force single chunk
    if (maxChunkSize >= data.length * 2) {
      targetChunks = 1
      minSplit = 1
      maxSplit = 1
    } else {
      // Calculate target chunks based on data size and desired chunk size
      targetChunks = Math.ceil(data.length / maxChunkSize)

      // For very small chunk sizes (which should create many simple QR codes),
      // we need to be more realistic about what the BBQR library can handle
      if (maxChunkSize <= 75 && targetChunks > 12) {
        // For very small chunks, aim for a reasonable number that the library can handle
        // but still more than larger chunk sizes would create
        targetChunks = Math.max(8, Math.min(targetChunks, 15))
      } else {
        // Limit maximum chunks to prevent impossible scenarios
        targetChunks = Math.min(targetChunks, 50)
      }

      // Be more strict about honoring the user's QR density choice
      // Only give minimal flexibility to handle QR version constraints
      let flexibility: number
      if (targetChunks <= 3) {
        flexibility = 1 // Very small flexibility for very low chunk counts
      } else if (targetChunks <= 10) {
        flexibility = 2 // Small flexibility for low-medium chunk counts
      } else {
        flexibility = 3 // Moderate flexibility for high chunk counts
      }

      minSplit = Math.max(1, targetChunks - flexibility)
      maxSplit = Math.min(50, targetChunks + flexibility)

      // For small chunk sizes, ensure we have a reasonable minimum
      if (maxChunkSize <= 75) {
        minSplit = Math.max(5, minSplit) // Ensure at least 5 chunks for small sizes
      }

      // If the flexibility range is too small and might cause "Cannot make it fit",
      // gradually increase the upper bound while keeping the lower bound closer to target
      if (maxSplit - minSplit < 3) {
        maxSplit = Math.min(50, targetChunks + 5)
      }
    }

    // Try to split with the calculated constraints
    let result
    try {
      result = splitQRs(data, officialFileType, {
        encoding: 'Z', // Try compression first (same as original implementation)
        minSplit,
        maxSplit,
        minVersion: 5 as Version,
        maxVersion: 40 as Version
      })
    } catch (error) {
      // If strict constraints fail, try with more flexibility
      let fallbackMinSplit = Math.max(1, Math.floor(targetChunks * 0.5))
      let fallbackMaxSplit = Math.min(50, Math.ceil(targetChunks * 1.5))

      // For small chunk sizes, ensure we still aim for multiple chunks
      if (maxChunkSize <= 75) {
        fallbackMinSplit = Math.max(3, fallbackMinSplit)
        fallbackMaxSplit = Math.max(8, fallbackMaxSplit)
      }

      try {
        result = splitQRs(data, officialFileType, {
          encoding: 'Z',
          minSplit: fallbackMinSplit,
          maxSplit: fallbackMaxSplit,
          minVersion: 5 as Version,
          maxVersion: 40 as Version
        })
      } catch (fallbackError) {
        // As last resort, let the library decide with minimal constraints
        try {
          result = splitQRs(data, officialFileType, {
            encoding: 'Z',
            minSplit: 1,
            maxSplit: Math.min(50, targetChunks * 2),
            minVersion: 5 as Version,
            maxVersion: 40 as Version
          })
        } catch (finalError) {
          // Ultimate fallback: let the library use its default settings
          result = splitQRs(data, officialFileType, {
            encoding: 'Z' // Let library choose all other defaults
          })
        }
      }
    }

    // Ensure we always return at least one chunk
    if (!result.parts || result.parts.length === 0) {
      throw new Error('BBQR produced no chunks')
    }

    return result.parts
  } catch (error) {
    // As absolute last resort, create a simple non-BBQR fallback
    // This ensures we never return empty and the UI doesn't break
    const chunkSize = Math.max(100, maxChunkSize)
    const chunks: string[] = []
    const dataStr = Array.from(data)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    for (let i = 0; i < dataStr.length; i += chunkSize) {
      const chunk = dataStr.slice(i, i + chunkSize)
      chunks.push(`FALLBACK_${Math.floor(i / chunkSize) + 1}: ${chunk}`)
    }

    return chunks
  }
}

/**
 * Decode BBQR chunks back to binary data
 * This function maintains backward compatibility with the original API
 */
export function decodeBBQRChunks(chunks: string[]): Uint8Array | null {
  try {
    // Validate all chunks are BBQR fragments
    if (!chunks.every(isBBQRFragment)) {
      return null
    }

    const result = joinQRs(chunks)

    return result.raw
  } catch (error) {
    return null
  }
}
