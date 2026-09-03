import { Buffer } from 'buffer'

const PEM_BEGIN = '-----BEGIN CERTIFICATE-----'
const PEM_END = '-----END CERTIFICATE-----'
const PEM_LINE_LENGTH = 64

function decodeBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (normalized.length % 4)) % 4
  return Buffer.from(normalized + '='.repeat(padLen), 'base64')
}

function wrapDerBase64AsPem(b64: string): string {
  const compact = b64.replace(/\s+/g, '')
  const lines = compact.match(new RegExp(`.{1,${PEM_LINE_LENGTH}}`, 'g')) ?? [
    compact
  ]
  return `${PEM_BEGIN}\n${lines.join('\n')}\n${PEM_END}\n`
}

/**
 * lndconnect `cert` is url-safe base64 of the PEM body (or a full PEM / DER).
 * Native TLS needs a PEM block.
 */
export function pairingCertToPem(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('LND pairing certificate is empty')
  }
  if (trimmed.includes(PEM_BEGIN)) {
    return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`
  }

  const compact = trimmed.replace(/\s+/g, '')
  const decoded = decodeBase64Url(compact)
  const asText = decoded.toString('utf8').trim()
  if (asText.includes(PEM_BEGIN)) {
    return asText.endsWith('\n') ? asText : `${asText}\n`
  }

  const derSequenceTag = 0x30
  if (decoded.length > 0 && decoded[0] === derSequenceTag) {
    return wrapDerBase64AsPem(decoded.toString('base64'))
  }

  return wrapDerBase64AsPem(asText.replace(/\s+/g, ''))
}
