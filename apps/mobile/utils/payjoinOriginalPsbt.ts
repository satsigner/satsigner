const PSBT_MAGIC_BASE64 = 'cHNidP'
const PSBT_MAGIC_HEX = '70736274'
const PSBT_MAGIC_BYTES = [0x70, 0x73, 0x62, 0x74] as const
const HEX_STRING_PATTERN = /^(?:0x)?[0-9a-fA-F]+$/

function bytesLookLikePsbt(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === PSBT_MAGIC_BYTES[0] &&
    bytes[1] === PSBT_MAGIC_BYTES[1] &&
    bytes[2] === PSBT_MAGIC_BYTES[2] &&
    bytes[3] === PSBT_MAGIC_BYTES[3]
  )
}

function hexToPsbtBase64(hex: string): string | undefined {
  const clean =
    hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex
  if (clean.length < 10 || clean.length % 2 !== 0) {
    return undefined
  }
  if (!clean.toLowerCase().startsWith(PSBT_MAGIC_HEX)) {
    return undefined
  }
  if (!HEX_STRING_PATTERN.test(clean)) {
    return undefined
  }
  const bytes = Buffer.from(clean, 'hex')
  if (!bytesLookLikePsbt(bytes)) {
    return undefined
  }
  return bytes.toString('base64')
}

function numbersToPsbtBase64(values: unknown[]): string | undefined {
  if (values.length < 5) {
    return undefined
  }
  const bytes = new Uint8Array(values.length)
  for (const [index, value] of values.entries()) {
    if (typeof value !== 'number' || value < 0 || value > 255) {
      return undefined
    }
    bytes[index] = value
  }
  if (!bytesLookLikePsbt(bytes)) {
    return undefined
  }
  return Buffer.from(bytes).toString('base64')
}

function psbtFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string') {
    if (value.startsWith(PSBT_MAGIC_BASE64)) {
      return value
    }
    const fromHex = hexToPsbtBase64(value)
    if (fromHex) {
      return fromHex
    }
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return psbtFromUnknown(JSON.parse(value))
      } catch {
        return undefined
      }
    }
    return undefined
  }
  if (Array.isArray(value)) {
    const fromBytes = numbersToPsbtBase64(value)
    if (fromBytes) {
      return fromBytes
    }
    for (const item of value) {
      const found = psbtFromUnknown(item)
      if (found) {
        return found
      }
    }
    return undefined
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = psbtFromUnknown(item)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

function extractPayjoinOriginalPsbt(events: string[]): string | undefined {
  for (const raw of [...events].toReversed()) {
    const found = psbtFromUnknown(raw)
    if (found) {
      return found
    }
  }
  return undefined
}

export { extractPayjoinOriginalPsbt }
