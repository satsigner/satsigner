import ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from 'bitcoinjs-lib'
import { nip19 } from 'nostr-tools'

// Initialize ECC library
bitcoinjs.initEccLib(ecc)

export async function generateColorFromNpub(npub: string): Promise<string> {
  try {
    // Convert npub to pubkey
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
  } catch (_error) {
    return '#404040' // Default color on error
  }
}
