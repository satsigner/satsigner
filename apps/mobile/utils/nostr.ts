import ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from 'bitcoinjs-lib'
import CBOR from 'cbor-js'
import { getPublicKey, nip19 } from 'nostr-tools'
import pako from 'pako'

import { base85Decode, base85Encode } from '@/utils/base58'
import { sha256 } from '@/utils/crypto'
import { parseDescriptor } from '@/utils/parse'
import { type TransactionData } from '@/utils/psbt'

// Initialize ECC library
bitcoinjs.initEccLib(ecc)

export async function generateColorFromNpub(npub: string): Promise<string> {
  const decoded = nip19.decode(npub)
  if (!decoded || decoded.type !== 'npub') {
    return '#404040' // Default color for invalid npub
  }
  const pubkey = npub

  // Generate color from hash - match Python's hashlib.sha256() output
  const hash = bitcoinjs.crypto.sha256(Buffer.from(pubkey)).toString('hex')
  const seed = BigInt('0x' + hash)
  const hue = Number(seed % BigInt(360)) // Map to a hue value between 0-359

  const saturation = 255 // High saturation for vividness
  const lightness = 180 // Dark mode value (180/255 * 100 ≈ 70%)

  // QColor's HSL to RGB conversion algorithm
  const h = hue / 60
  const s = saturation / 255
  const l = lightness / 255

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = l - c / 2

  let r, g, b
  if (h < 1) [r, g, b] = [c, x, 0]
  else if (h < 2) [r, g, b] = [x, c, 0]
  else if (h < 3) [r, g, b] = [0, c, x]
  else if (h < 4) [r, g, b] = [0, x, c]
  else if (h < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function deriveNpubFromNsec(nsec: string): string | null {
  if (!nsec?.trim()) return null
  try {
    const decoded = nip19.decode(nsec.trim())
    if (!decoded || decoded.type !== 'nsec') return null
    const publicKey = getPublicKey(decoded.data as Uint8Array)
    return nip19.npubEncode(publicKey)
  } catch {
    return null
  }
}

export function parseNostrTransaction(
  transaction: string
): TransactionData | null {
  if (transaction.trim().startsWith('cHNidP')) {
    const transactionData: TransactionData = {
      combinedPsbt: transaction.trim()
    }
    return transactionData
  }
  return null
}

export function compressMessage(data: object): string {
  const cborData = CBOR.encode(data)
  const jsonUint8 = new Uint8Array(cborData)
  const compressedData = pako.deflate(jsonUint8)
  const compressedBuffer = Buffer.from(compressedData)
  return base85Encode(compressedBuffer)
}

export function decompressMessage(compressedString: string): unknown {
  const compressedBytes = base85Decode(compressedString)
  const cborBytes = pako.inflate(new Uint8Array(compressedBytes))
  const bufferSlice = cborBytes.buffer.slice(
    cborBytes.byteOffset,
    cborBytes.byteOffset + cborBytes.byteLength
  )
  return CBOR.decode(bufferSlice as unknown as Uint8Array)
}

export async function deriveNostrKeysFromDescriptor(
  externalDescriptor: string
): Promise<{
  commonNsec: string
  commonNpub: string
  privateKeyBytes: Uint8Array
}> {
  const { hardenedPath, xpubs } = parseDescriptor(externalDescriptor)
  const totalString = `${hardenedPath}${xpubs.join('')}`
  const firstHash = await sha256(totalString)
  const doubleHash = await sha256(firstHash)
  const privateKeyBytes = new Uint8Array(Buffer.from(doubleHash, 'hex'))
  const publicKey = getPublicKey(privateKeyBytes)
  const commonNsec = nip19.nsecEncode(privateKeyBytes)
  const commonNpub = nip19.npubEncode(publicKey)
  return { commonNsec, commonNpub, privateKeyBytes }
}
