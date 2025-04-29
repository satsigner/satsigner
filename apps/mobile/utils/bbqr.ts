/**
 * BBQR (Better Bitcoin QR) utility functions
 * This module provides functions for creating and managing QR code chunks
 * for large binary data like PSBTs.
 */

import * as pako from 'pako'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const HEADER_PREFIX = 'B$'

enum BBQREncoding {
  ZLIB = 'Z',
  BASE32 = '2',
  HEX = 'H'
}

enum BBQRType {
  PSBT = 'P',
  TXN = 'T'
}

interface BBQRHeader {
  encoding: BBQREncoding
  type: BBQRType
  seqTotal: number
  seqNumber: number
}

// Part modulo for each encoding type
const ENCODING_MODULO = {
  [BBQREncoding.ZLIB]: 5,
  [BBQREncoding.BASE32]: 5,
  [BBQREncoding.HEX]: 2
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

function base32Decode(str: string): Uint8Array {
  let bits = 0
  let value = 0
  const bytes = []
  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) throw new Error('Invalid base32 character')

    value = (value << 5) | index
    bits += 5
    while (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(bytes)
}

function encodeToBase36(number: number): string {
  // Convert to base36 and pad to 2 digits
  return number.toString(36).padStart(2, '0').toUpperCase()
}

function decodeFromBase36(base36: string): number {
  return parseInt(base36, 36)
}

function createHeader(header: BBQRHeader): string {
  return `${HEADER_PREFIX}${header.encoding}${header.type}${encodeToBase36(header.seqTotal)}${encodeToBase36(header.seqNumber)}`
}

function parseHeader(part: string): BBQRHeader {
  if (part.length < 8) {
    throw new Error('Part too short')
  }

  if (!part.startsWith(HEADER_PREFIX)) {
    throw new Error(`Part does not start with ${HEADER_PREFIX}`)
  }

  const encoding = part.slice(2, 3) as BBQREncoding
  const type = part.slice(3, 4) as BBQRType
  const seqTotal = decodeFromBase36(part.slice(4, 6))
  const seqNumber = decodeFromBase36(part.slice(6, 8))

  return { encoding, type, seqTotal, seqNumber }
}

export function isBBQRFragment(part: string): boolean {
  try {
    parseHeader(part)
    return true
  } catch (_e) {
    return false
  }
}

export function createBBQRChunks(
  data: Uint8Array,
  maxChunkSize: number = 400
): string[] {
  // Try ZLIB compression first
  let encoded: string
  let encoding = BBQREncoding.ZLIB

  try {
    const compressed = pako.deflate(data)
    const zlibEncoded = base32Encode(compressed)
    const uncompressed = base32Encode(data)

    // Use compression only if it helps
    if (zlibEncoded.length > uncompressed.length) {
      throw new Error('Compressed data was larger than uncompressed data')
    }
    encoded = zlibEncoded
  } catch (_e) {
    // Fallback to BASE32 if compression fails
    encoded = base32Encode(data)
    encoding = BBQREncoding.BASE32
  }

  // Calculate chunk size using Sparrow's algorithm
  const inputLength = encoded.length
  const numChunks = Math.ceil((inputLength + maxChunkSize - 1) / maxChunkSize)
  const chunkSize =
    numChunks === 1 ? maxChunkSize : Math.ceil(inputLength / numChunks)

  // Adjust chunk size to match encoding modulo
  const modulo = chunkSize % ENCODING_MODULO[encoding]
  const adjustedChunkSize =
    modulo > 0 ? chunkSize + (ENCODING_MODULO[encoding] - modulo) : chunkSize

  const chunks: string[] = []
  let startIndex = 0

  for (let i = 0; i < numChunks; i++) {
    const endIndex = Math.min(startIndex + adjustedChunkSize, encoded.length)
    const chunk = encoded.slice(startIndex, endIndex)

    const header: BBQRHeader = {
      encoding,
      type: BBQRType.PSBT,
      seqTotal: numChunks,
      seqNumber: i + 1
    }

    // Ensure chunk is properly padded
    const paddedChunk = chunk.padEnd(adjustedChunkSize, '=')
    chunks.push(`${createHeader(header)}${paddedChunk}`)
    startIndex = endIndex
  }

  return chunks
}

export function decodeBBQRChunks(chunks: string[]): Uint8Array | null {
  try {
    // Validate all chunks are BBQR fragments
    if (!chunks.every(isBBQRFragment)) {
      throw new Error('Invalid BBQR fragment')
    }

    // Sort chunks by part number using TreeMap-like approach
    const sortedChunks = chunks.sort((a, b) => {
      const aHeader = parseHeader(a)
      const bHeader = parseHeader(b)
      return aHeader.seqNumber - bHeader.seqNumber
    })

    // Extract data from chunks
    const data = sortedChunks.map((chunk) => chunk.slice(8)).join('')

    // Decode base32
    const bytes = base32Decode(data)

    // Check if data is compressed
    const firstChunk = sortedChunks[0]
    const header = parseHeader(firstChunk)

    if (header.encoding === BBQREncoding.ZLIB) {
      return pako.inflate(bytes)
    } else {
      return bytes
    }
  } catch (_e) {
    return null
  }
}
