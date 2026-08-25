import {
  LNDCONNECT_DEFAULT_REST_PORT,
  LND_GRPC_LISTEN_PORT
} from '@/constants/lightning'
import type { LNDConfig } from '@/types/models/Lightning'

export type ParsedLndConnectionInput =
  | { kind: 'inline'; config: LNDConfig }
  | { kind: 'remoteConfigUrl'; url: string }

type JsonRecord = Record<string, unknown>

export function stripJsonBom(text: string): string {
  return text.replace(/^\uFEFF/, '').trim()
}

export function normalizeLndRestBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function isSupportedLndHttpPairingType(type: string): boolean {
  const normalized = type.trim().toLowerCase()
  return (
    normalized === 'lnd-rest' ||
    normalized === 'lnd-grpc' ||
    normalized === 'lnd'
  )
}

function assertSupportedLndPairingType(type: string | undefined) {
  if (!type || isSupportedLndHttpPairingType(type)) {
    return
  }
  throw new Error(`Unsupported connection type: ${type}`)
}

/**
 * BTCPay LND RPC/gRPC pairing uses the same macaroon but a gRPC URI.
 * The app talks LND REST, so rewrite common gRPC hosts/paths to REST.
 */
export function restBaseUrlFromPairingUri(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  const withScheme = trimmed.replace(/^grpcs?:\/\//i, 'https://')
  const candidate = /:\/\//.test(withScheme)
    ? withScheme
    : `https://${withScheme}`
  const parsed = new URL(candidate)
  if (parsed.port === LND_GRPC_LISTEN_PORT) {
    parsed.port = LNDCONNECT_DEFAULT_REST_PORT
  }
  parsed.pathname = parsed.pathname.replace(
    /\/lnd-grpc(?=\/|$)/gi,
    '/lnd-rest'
  )
  return normalizeLndRestBaseUrl(parsed.toString())
}

function dequote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
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
  if (
    /^https?:\/\/.+/i.test(urlCandidate) &&
    /\.config(?:[/?#]|$)/i.test(urlCandidate)
  ) {
    return urlCandidate
  }
  return null
}

function compactUri(raw: string): string {
  return raw.replace(/\s+/g, '')
}

function decodeLndConnectQueryValue(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, '%2B'))
  } catch {
    return raw
  }
}

function getLndConnectQueryParam(
  query: string,
  names: string[]
): string | null {
  const wanted = new Set(names.map((n) => n.toLowerCase()))
  for (const part of query.split('&')) {
    if (!part) {
      continue
    }
    const eq = part.indexOf('=')
    const keyRaw = eq === -1 ? part : part.slice(0, eq)
    const key = decodeLndConnectQueryValue(keyRaw).toLowerCase()
    if (!wanted.has(key)) {
      continue
    }
    if (eq === -1) {
      return ''
    }
    return decodeLndConnectQueryValue(part.slice(eq + 1))
  }
  return null
}

function parseLndConnectHostPort(hostPort: string): {
  host: string
  port: string
} {
  if (hostPort.startsWith('[')) {
    const close = hostPort.indexOf(']')
    if (close === -1) {
      throw new Error('lndconnect URI missing host')
    }
    const host = hostPort.slice(1, close)
    const after = hostPort.slice(close + 1)
    const port = after.startsWith(':')
      ? after.slice(1)
      : LNDCONNECT_DEFAULT_REST_PORT
    return { host, port: port || LNDCONNECT_DEFAULT_REST_PORT }
  }
  const colon = hostPort.lastIndexOf(':')
  if (colon === -1) {
    return { host: hostPort, port: LNDCONNECT_DEFAULT_REST_PORT }
  }
  return {
    host: hostPort.slice(0, colon),
    port: hostPort.slice(colon + 1) || LNDCONNECT_DEFAULT_REST_PORT
  }
}

/**
 * Zap/lndconnect URI: `lndconnect://host:port?cert=…&macaroon=…`
 * Host may be a `.onion` address. REST is always treated as HTTPS.
 */
export function parseLndConnectUri(raw: string): LNDConfig {
  const compact = compactUri(raw)
  if (!/^lndconnect:\/\//i.test(compact)) {
    throw new Error('Not an lndconnect URI')
  }
  const rest = compact.replace(/^lndconnect:\/\//i, '')
  const qIndex = rest.indexOf('?')
  const hostPort = qIndex === -1 ? rest : rest.slice(0, qIndex)
  const query = qIndex === -1 ? '' : rest.slice(qIndex + 1)
  const { host, port } = parseLndConnectHostPort(hostPort)
  if (!host) {
    throw new Error('lndconnect URI missing host')
  }
  const macaroonParam =
    getLndConnectQueryParam(query, ['macaroon', 'macaroon_hex']) || ''
  if (!macaroonParam) {
    throw new Error('lndconnect URI missing macaroon')
  }
  const certParam =
    getLndConnectQueryParam(query, ['cert', 'certificate']) || ''
  return {
    cert: certParam,
    macaroon: macaroonToLndRestHexHeader(macaroonParam),
    url: normalizeLndRestBaseUrl(`https://${host}:${port}`)
  }
}

export function parseLndConnectionInput(
  raw: string
): ParsedLndConnectionInput | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  if (/^lndconnect:\/\//i.test(compactUri(trimmed))) {
    try {
      return { kind: 'inline', config: parseLndConnectUri(trimmed) }
    } catch {
      return null
    }
  }
  if (
    /type=lnd-rest/i.test(trimmed) ||
    /type=lnd-grpc/i.test(trimmed) ||
    (/server=/i.test(trimmed) &&
      /macaroon=/i.test(trimmed) &&
      !trimmed.startsWith('{') &&
      !trimmed.startsWith('['))
  ) {
    try {
      return {
        kind: 'inline',
        config: parseLndRemotePairingConnectionString(trimmed)
      }
    } catch {
      return null
    }
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return {
        kind: 'inline',
        config: parseLndRemotePairingFromJsonText(trimmed)
      }
    } catch {
      return null
    }
  }
  const configUrl = getLndConfigFileUrlFromConnectionInput(trimmed)
  if (configUrl) {
    return { kind: 'remoteConfigUrl', url: configUrl }
  }
  return null
}

export async function resolveLndConfigFromConnectionInput(
  raw: string
): Promise<LNDConfig> {
  const parsed = parseLndConnectionInput(raw)
  if (!parsed) {
    throw new Error('Unrecognized LND connection input')
  }
  if (parsed.kind === 'inline') {
    return parsed.config
  }
  return fetchLndConfig(parsed.url)
}

/**
 * LND REST expects `Grpc-Metadata-macaroon` as the macaroon bytes in
 * hexadecimal. Hosts often ship base64 or base64url in JSON.
 */
export function macaroonToLndRestHexHeader(raw: string): string {
  const normalized = raw.trim().replace(/\s+/g, '')
  const s =
    normalized.startsWith('0x') || normalized.startsWith('0X')
      ? normalized.slice(2)
      : normalized
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
    const [first] = parsed
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
    const [first] = configurations
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
  const pairingType = entry.type
  assertSupportedLndPairingType(
    typeof pairingType === 'string' ? pairingType : undefined
  )
  return {
    cert: pickCert(entry),
    macaroon: macaroonToLndRestHexHeader(macaroonRaw),
    url: restBaseUrlFromPairingUri(url)
  }
}

export function parseLndRemotePairingFromJsonText(text: string): LNDConfig {
  const trimmed = stripJsonBom(text)
  return parseLndRemotePairingFromParsedJson(parseJsonOrThrow(trimmed))
}

function parseJsonOrThrow(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Config file is not valid JSON')
  }
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
    map[key] = dequote(part.slice(eq + 1).trim())
  }
  const type = map.type?.toLowerCase()
  assertSupportedLndPairingType(type)
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
    url: restBaseUrlFromPairingUri(server)
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
    lower.includes('type=lnd-grpc') ||
    (lower.includes('server=') &&
      (lower.includes('macaroon=') ||
        lower.includes('macaroon_hex=') ||
        lower.includes('admin_macaroon_hex=')) &&
      !text.startsWith('{') &&
      !text.startsWith('['))
  ) {
    return parseLndRemotePairingConnectionString(text)
  }
  if (text.startsWith('{') || text.startsWith('[')) {
    return parseLndRemotePairingFromJsonText(text)
  }
  throw new Error('Unrecognized LND pairing payload')
}
