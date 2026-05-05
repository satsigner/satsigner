import type { LNDConfig } from '@/types/models/LND'

type JsonRecord = Record<string, unknown>

export function stripJsonBom(text: string): string {
  return text.replace(/^\uFEFF/, '').trim()
}

export function normalizeLndRestBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/**
 * Resolves the downloadable LND pairing file URL from the text field or QR.
 * Accepts `config=https://…/file.config` or a bare `https://…/file.config` URL
 * (first line only for multiline paste).
 */
export function getLndConfigFileUrlFromConnectionInput(
  raw: string
): string | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  if (/^config=/i.test(trimmed)) {
    const u = trimmed.replace(/^config=/i, '').trim()
    return u.length > 0 ? u : null
  }
  const firstLine = (trimmed.split(/\r?\n/)[0] ?? trimmed).trim()
  const urlCandidate = firstLine.split(/\s+/)[0] ?? firstLine
  if (/^https?:\/\/.+/i.test(urlCandidate)) {
    if (/\.config(?:[/?#]|$)/i.test(urlCandidate)) {
      return urlCandidate
    }
  }
  return null
}

/**
 * LND REST expects `Grpc-Metadata-macaroon` as the macaroon bytes in
 * hexadecimal. Hosts often ship base64 or base64url in JSON.
 */
export function macaroonToLndRestHexHeader(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '')
  if (s.startsWith('0x') || s.startsWith('0X')) {
    s = s.slice(2)
  }
  if (/^[0-9a-fA-F]+$/.test(s)) {
    if (s.length % 2 === 1) {
      throw new Error('Macaroon hex has odd length')
    }
    return s.toLowerCase()
  }

  const decodeBase64Padded = (input: string): Buffer | null => {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
    const padLen = (4 - (normalized.length % 4)) % 4
    const padded = normalized + '='.repeat(padLen)
    try {
      return Buffer.from(padded, 'base64')
    } catch {
      return null
    }
  }

  const buf = decodeBase64Padded(s)
  if (buf && buf.length > 0) {
    return buf.toString('hex')
  }

  throw new Error('Macaroon must be hex or base64')
}

function pickCert(entry: JsonRecord): string {
  const c = entry.cert ?? entry.certificate ?? entry.tls_cert ?? entry.tlsCert
  return typeof c === 'string' ? c : ''
}

function pickMacaroon(entry: JsonRecord): string | null {
  const candidates = [
    entry.macaroon,
    entry.admin_macaroon_hex,
    entry.adminMacaroon,
    entry.macaroon_hex,
    entry.macaroonHex
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      return c
    }
  }
  return null
}

function pickRestUrl(entry: JsonRecord): string | null {
  const keys = [
    'uri',
    'url',
    'restUrl',
    'endpoint',
    'server',
    'rest_uri',
    'restUri'
  ]
  for (const k of keys) {
    const v = entry[k]
    if (typeof v === 'string' && v.trim()) {
      return v.trim()
    }
  }
  return null
}

function extractLndRestEntry(parsed: unknown): JsonRecord | null {
  if (Array.isArray(parsed) && parsed.length > 0) {
    const first = parsed[0]
    if (first && typeof first === 'object') {
      return first as JsonRecord
    }
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }
  const json = parsed as JsonRecord
  const { configurations } = json
  if (Array.isArray(configurations) && configurations.length > 0) {
    const first = configurations[0]
    if (first && typeof first === 'object') {
      return first as JsonRecord
    }
  }
  if (json.configuration && typeof json.configuration === 'object') {
    return json.configuration as JsonRecord
  }
  if (pickRestUrl(json) && pickMacaroon(json)) {
    return json
  }
  return null
}

function parseLndRemotePairingFromParsedJson(parsed: unknown): LNDConfig {
  const entry = extractLndRestEntry(parsed)
  if (!entry) {
    throw new Error(
      'Unrecognized LND config JSON (expected URL + macaroon fields)'
    )
  }
  const url = pickRestUrl(entry)
  const macaroonRaw = pickMacaroon(entry)
  if (!url || !macaroonRaw) {
    throw new Error('Config JSON missing REST base URL or macaroon')
  }
  return {
    cert: pickCert(entry),
    macaroon: macaroonToLndRestHexHeader(macaroonRaw),
    url: normalizeLndRestBaseUrl(url)
  }
}

export function parseLndRemotePairingFromJsonText(text: string): LNDConfig {
  const trimmed = stripJsonBom(text)
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error('Config file is not valid JSON')
  }
  return parseLndRemotePairingFromParsedJson(parsed)
}

/**
 * BTCPay-style: type=lnd-rest;server=https://...;macaroon=...;cert=...
 */
export function parseLndRemotePairingConnectionString(text: string): LNDConfig {
  const trimmed = text.trim()
  const parts = trimmed
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
  const map: Record<string, string> = {}
  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq === -1) {
      continue
    }
    const key = part.slice(0, eq).trim().toLowerCase()
    let value = part.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    map[key] = value
  }
  const type = map.type?.toLowerCase()
  if (type && type !== 'lnd-rest') {
    throw new Error(`Unsupported connection type: ${map.type}`)
  }
  const server = map.server || map.resturl || map.endpoint || map.url || map.uri
  const mac =
    map.macaroon ||
    map.macaroon_hex ||
    map.admin_macaroon_hex ||
    map.macaroonhex
  if (!server || !mac) {
    throw new Error('Connection string missing server or macaroon')
  }
  return {
    cert: map.cert || map.certificate || '',
    macaroon: macaroonToLndRestHexHeader(mac),
    url: normalizeLndRestBaseUrl(server)
  }
}

export async function fetchLndConfig(configUrl: string): Promise<LNDConfig> {
  const response = await fetch(configUrl)
  const text = await response.text()
  if (!response.ok) {
    const hint = text.replace(/\s+/g, ' ').trim().slice(0, 140)
    throw new Error(
      hint
        ? `Config fetch failed (${response.status}): ${hint}`
        : `Config fetch failed (${response.status})`
    )
  }
  return parseLndRemotePairingPayload(text)
}

export function parseLndRemotePairingPayload(rawText: string): LNDConfig {
  const text = stripJsonBom(rawText)
  const lower = text.toLowerCase()
  if (
    lower.includes('type=lnd-rest') ||
    (lower.includes('server=') &&
      (lower.includes('macaroon=') ||
        lower.includes('macaroon_hex=') ||
        lower.includes('admin_macaroon_hex=')))
  ) {
    return parseLndRemotePairingConnectionString(text)
  }
  if (text.startsWith('{') || text.startsWith('[')) {
    return parseLndRemotePairingFromJsonText(text)
  }
  throw new Error('Unrecognized LND pairing payload')
}
