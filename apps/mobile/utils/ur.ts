import { UR, UREncoder } from '@ngraveio/bc-ur'
import { Buffer } from 'buffer'

export interface URData {
  type: string
  data: Uint8Array
}

export function encodePSBTToUR(
  psbtHex: string,
  fragmentSize: number = 400
): string[] {
  // Convert hex string to bytes
  const psbtBytes = Buffer.from(psbtHex, 'hex')

  // Create UR object with type 'crypto-psbt'
  const ur = new UR(psbtBytes, 'crypto-psbt')

  // Use provided fragment size
  const encoder = new UREncoder(ur, fragmentSize)

  const uniqueChunks = new Set<string>()
  // Collect up to 30 unique fragments for robust animated QR
  for (let i = 0; i < 30; i++) {
    uniqueChunks.add(encoder.nextPart())
    if (uniqueChunks.size === encoder.fragments.length) break
  }

  return Array.from(uniqueChunks)
}

export function decodeURToPSBT(ur: string): string {
  // TODO: Implement UR decoding
  return ''
}

// New utility: Generate UR fragments from a PSBT base64 string
export function getURFragmentsFromPSBT(
  psbt: string,
  format: 'base64' | 'hex' = 'hex',
  fragmentSize = 100
): string[] {
  // Convert input to bytes based on format
  const psbtBytes = Buffer.from(psbt, format)

  // Create UR object with type 'crypto-psbt'
  const ur = new UR(psbtBytes, 'crypto-psbt')

  // Create encoder with specified fragment size
  const encoder = new UREncoder(ur, fragmentSize)

  // Collect unique fragments
  const uniqueFragments = new Set<string>()
  for (let i = 0; i < 30; i++) {
    uniqueFragments.add(encoder.nextPart())
    if (uniqueFragments.size === encoder.fragments.length) break
  }

  return Array.from(uniqueFragments)
}
