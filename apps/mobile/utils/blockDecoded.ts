import ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from 'bitcoinjs-lib'
import varuint from 'varuint-bitcoin'

import { TxDecoded, type TxDecodedField, TxField } from '@/utils/txDecoded'

bitcoinjs.initEccLib(ecc)

export enum BlockField {
  Version = 'blockVersion',
  PrevHash = 'prevHash',
  MerkleRoot = 'merkleRoot',
  Timestamp = 'timestamp',
  Bits = 'bits',
  Nonce = 'nonce',
  TxCount = 'txCount'
}

export type BlockDecodedField = {
  hex: string
  field: BlockField | TxField
  value: string | number
  placeholders?: Record<string, string | number>
}

export type DecodeBlockResult = {
  fields: BlockDecodedField[]
  truncated: boolean
  txDecoded: number
  txTotal: number
}

/** Cap displayed decoded hex so large blocks stay interactive. */
export const BLOCK_DECODE_PREVIEW_CHARS = 8_192

/**
 * Extra binary headroom so fat coinbases can still parse even when the
 * displayed field budget is small. Keeps Buffer.from bounded on multi-MB blocks.
 */
const PARSE_HEADROOM_BYTES = 1_000_000

/** Skip Transaction.fromHex on huge blobs — that path is extremely expensive. */
const TX_PROBE_MAX_HEX_CHARS = 100_000

function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase().replace(/^0x/, '').replace(/\s+/g, '')
}

function bytesToHex(bytes: Buffer | Uint8Array): string {
  return Buffer.from(bytes).toString('hex')
}

/** Display-order (big-endian) hex without mutating the source buffer. */
function reverseBytesDisplayHex(bytes: Buffer | Uint8Array): string {
  const { length } = bytes
  const copy = Buffer.allocUnsafe(length)
  for (let i = 0; i < length; i += 1) {
    copy[i] = bytes[length - 1 - i] ?? 0
  }
  return copy.toString('hex')
}

function toUInt32LEHex(value: number): string {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(value)
  return bytesToHex(buffer)
}

function asTxDecoded(tx: bitcoinjs.Transaction): TxDecoded {
  Object.setPrototypeOf(tx, TxDecoded.prototype)
  return tx as TxDecoded
}

function parsePrefixBuffer(clean: string, maxBytes: number): Buffer {
  const maxChars = maxBytes * 2
  const parseHex = clean.length > maxChars ? clean.slice(0, maxChars) : clean
  return Buffer.from(parseHex, 'hex')
}

/**
 * True when hex is a serialized block (not a lone transaction).
 * Pure txs parse cleanly with Transaction.fromHex; blocks do not.
 */
export function looksLikeBlockHex(hex: string): boolean {
  const clean = normalizeHex(hex)
  if (clean.length < 160) {
    return false
  }

  if (clean.length <= TX_PROBE_MAX_HEX_CHARS) {
    try {
      bitcoinjs.Transaction.fromHex(clean)
      return false
    } catch {
      // Not a standalone transaction — may still be a block.
    }
  }

  try {
    const buffer = parsePrefixBuffer(clean, 80 + PARSE_HEADROOM_BYTES)
    if (buffer.length < 81) {
      return false
    }
    const txTotal = varuint.decode(buffer, 80)
    if (txTotal < 1) {
      return false
    }
    const txCountLen = varuint.encodingLength(txTotal)
    const txStart = 80 + txCountLen
    if (txStart >= buffer.length) {
      return false
    }
    // Bounded window — do not copy the rest of a multi-MB block.
    const window = Buffer.from(buffer.subarray(txStart))
    bitcoinjs.Transaction.fromBuffer(window, true)
    return true
  } catch {
    return false
  }
}

/**
 * Decode a serialized block into colored fields (header + txs).
 * Stops once the cumulative hex length reaches maxHexChars.
 */
export function decodeBlockFromHex(
  hex: string,
  maxHexChars = BLOCK_DECODE_PREVIEW_CHARS
): DecodeBlockResult {
  const clean = normalizeHex(hex)
  const maxParseBytes = Math.ceil(maxHexChars / 2) + PARSE_HEADROOM_BYTES
  const maxParseChars = maxParseBytes * 2
  const parseHex =
    clean.length > maxParseChars ? clean.slice(0, maxParseChars) : clean
  const buffer = Buffer.from(parseHex, 'hex')
  const inputTruncated = parseHex.length < clean.length

  if (buffer.length < 80) {
    throw new Error('Block hex too short for header')
  }

  const fields: BlockDecodedField[] = []
  let usedChars = 0

  function push(field: BlockDecodedField) {
    fields.push(field)
    usedChars += field.hex.length
  }

  const version = buffer.readUInt32LE(0)
  push({
    field: BlockField.Version,
    hex: bytesToHex(buffer.subarray(0, 4)),
    value: version
  })

  const prevHashBytes = buffer.subarray(4, 36)
  push({
    field: BlockField.PrevHash,
    hex: bytesToHex(prevHashBytes),
    value: reverseBytesDisplayHex(prevHashBytes)
  })

  const merkleRootBytes = buffer.subarray(36, 68)
  push({
    field: BlockField.MerkleRoot,
    hex: bytesToHex(merkleRootBytes),
    value: reverseBytesDisplayHex(merkleRootBytes)
  })

  const timestamp = buffer.readUInt32LE(68)
  push({
    field: BlockField.Timestamp,
    hex: toUInt32LEHex(timestamp),
    value: timestamp
  })

  const bits = buffer.readUInt32LE(72)
  push({
    field: BlockField.Bits,
    hex: toUInt32LEHex(bits),
    value: bits
  })

  const nonce = buffer.readUInt32LE(76)
  push({
    field: BlockField.Nonce,
    hex: toUInt32LEHex(nonce),
    value: nonce
  })

  let offset = 80
  if (offset >= buffer.length) {
    return { fields, truncated: true, txDecoded: 0, txTotal: 0 }
  }

  const txTotal = varuint.decode(buffer, offset)
  const txCountLen = varuint.encodingLength(txTotal)
  push({
    field: BlockField.TxCount,
    hex: bytesToHex(buffer.subarray(offset, offset + txCountLen)),
    value: txTotal
  })
  offset += txCountLen

  let txDecoded = 0
  let truncated = false

  for (let txIndex = 0; txIndex < txTotal; txIndex += 1) {
    if (usedChars >= maxHexChars || offset >= buffer.length) {
      truncated = true
      break
    }

    let tx: bitcoinjs.Transaction
    let txByteLength = 0
    try {
      // Copy remaining prefix only — buffer itself is already size-capped.
      const window = Buffer.from(buffer.subarray(offset))
      tx = bitcoinjs.Transaction.fromBuffer(window, true)
      txByteLength = tx.byteLength()
      if (txByteLength <= 0 || offset + txByteLength > buffer.length) {
        truncated = true
        break
      }
    } catch {
      truncated = true
      break
    }

    try {
      const txFields = asTxDecoded(tx).decode()
      for (const item of txFields) {
        if (usedChars + item.hex.length > maxHexChars && fields.length > 7) {
          truncated = true
          break
        }
        push(withTxIndex(item, txIndex))
      }
    } catch {
      truncated = true
      break
    }

    if (truncated) {
      break
    }

    offset += txByteLength
    txDecoded += 1
  }

  if (inputTruncated || txDecoded < txTotal) {
    truncated = true
  }

  return { fields, truncated, txDecoded, txTotal }
}

function withTxIndex(item: TxDecodedField, txIndex: number): BlockDecodedField {
  return {
    ...item,
    placeholders: {
      ...item.placeholders,
      tx: txIndex
    }
  }
}

const BLOCK_FIELD_VALUES = new Set<string>(Object.values(BlockField))

export function isBlockField(field: string): field is BlockField {
  return BLOCK_FIELD_VALUES.has(field)
}
