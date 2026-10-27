import type { DiagnosticResult } from './types'

type HostClass = 'localhost' | 'onion' | 'private' | 'public'

const URL_RE = /\b([a-z][a-z0-9+.-]*):\/\/[^\s'"<>()]+/gi
const BECH32_NOSTR_RE =
  /\b(npub|nsec|nprofile|nevent|naddr|note|ncryptsec)1[02-9ac-hj-np-z]{6,}\b/gi
const EXTENDED_KEY_RE = /\b[xyztuvYZUV]p(ub|rv)[1-9A-HJ-NP-Za-km-z]{50,}\b/g
const BECH32_ADDRESS_RE = /\b(bc|tb|bcrt)1[02-9ac-hj-np-z]{8,}\b/gi
const BASE58_ADDRESS_RE = /\b[123mn][1-9A-HJ-NP-Za-km-z]{25,34}\b/g
const HEX_ID_RE = /\b[0-9a-f]{64}\b/gi
const IPV4_RE = /\b\d{1,3}(\.\d{1,3}){3}\b/g
const PRIVATE_IPV4_RE =
  /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/

function classifyHost(host: string): HostClass {
  const lower = host.toLowerCase()
  if (lower.endsWith('.onion')) {
    return 'onion'
  }
  if (lower === 'localhost' || lower === '[::1]') {
    return 'localhost'
  }
  if (PRIVATE_IPV4_RE.test(lower) || lower.endsWith('.local')) {
    return 'private'
  }
  return 'public'
}

function hostOf(url: string): string {
  const withoutScheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  const [authority = ''] = withoutScheme.split(/[/?#]/)
  const hostAndPort = authority.includes('@')
    ? authority.slice(authority.lastIndexOf('@') + 1)
    : authority
  return hostAndPort.replace(/:\d+$/, '')
}

/** Keeps only the scheme and what kind of host it is: `wss://[public]`. */
function redactUrl(url: string): string {
  const [scheme = 'url'] = url.split('://')
  return `${scheme.toLowerCase()}://[${classifyHost(hostOf(url))}]`
}

const TRAILING_PUNCTUATION_RE = /[:.,;]+$/

function redactUrlMatch(match: string): string {
  const trailing = TRAILING_PUNCTUATION_RE.exec(match)?.[0] ?? ''
  return `${redactUrl(match.slice(0, match.length - trailing.length))}${trailing}`
}

function redactLine(line: string): string {
  return line
    .replace(URL_RE, redactUrlMatch)
    .replace(BECH32_NOSTR_RE, (_match, prefix: string) => `${prefix}1[…]`)
    .replace(EXTENDED_KEY_RE, '[xpub]')
    .replace(BECH32_ADDRESS_RE, '[address]')
    .replace(BASE58_ADDRESS_RE, '[address]')
    .replace(HEX_ID_RE, '[hex]')
    .replace(IPV4_RE, (ip) => `[${classifyHost(ip)}-ip]`)
}

function redactResult(result: DiagnosticResult): DiagnosticResult {
  return { ...result, lines: result.lines.map(redactLine) }
}

/** Plain-text report for the clipboard, with identifying details removed. */
function formatDiagnosticsReport(
  results: DiagnosticResult[],
  header: string[]
): string {
  const body = results
    .map(redactResult)
    .flatMap((result) => [
      `[${result.status.toUpperCase()}] ${result.category}/${result.id} (${result.durationMs}ms)`,
      ...result.lines.map((line) => `  ${line}`)
    ])
  return [...header.map(redactLine), '', ...body].join('\n')
}

export {
  classifyHost,
  formatDiagnosticsReport,
  redactLine,
  redactResult,
  redactUrl
}
export type { HostClass }
