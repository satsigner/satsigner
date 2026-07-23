import { SATS_PER_BITCOIN } from '@/constants/btc'
import {
  PAYJOIN_DEFAULT_PJOS,
  PAYJOIN_DIRECTORY_URL
} from '@/constants/payjoin'
import {
  type PayjoinEndpointKind,
  type PayjoinUriParams
} from '@/types/payjoin'

/**
 * BIP77 fragment delimiter: final BIP uses `-`; older PDK / Bull used `+`.
 * Accept both when parsing; prefer `-` when normalizing for final BIP77.
 */
const BIP77_FRAGMENT_DELIMITERS = ['-', '+'] as const

type ParsePayjoinUriResult = {
  isValid: boolean
  params?: PayjoinUriParams
  endpointKind?: PayjoinEndpointKind
  error?: string
}

function decodePjParam(raw: string): string {
  // BIP21 often percent-encodes the pj URL. Decode once; keep :// intact.
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    value = raw
  }
  // Some encoders turn :// into %3A%2F%2F — decodeURIComponent handles that.
  return value
}

/** PDK serializes endpoints as HTTPS://…%23FRAGMENT — normalize scheme case. */
function normalizePjEndpoint(pj: string): string {
  const decoded = decodePjParam(pj)
  const match = decoded.match(/^(https?):\/\//i)
  if (!match) {
    return decoded
  }
  return `${match[1].toLowerCase()}://${decoded.slice(match[0].length)}`
}

function isHttpPjEndpoint(pj: string): boolean {
  const lower = pj.toLowerCase()
  return lower.startsWith('https://') || lower.startsWith('http://')
}

/**
 * Encode pj for a BIP21 query: keep :// readable, percent-encode # so it is
 * not treated as the outer bitcoin: URI fragment (PDK / BIP77 style).
 */
function encodePjEndpointForQuery(pjEndpoint: string): string {
  return normalizePjEndpoint(pjEndpoint).replace(/#/g, '%23')
}

function normalizeBip77FragmentDelimiters(pjUrl: string): string {
  const hashIndex = pjUrl.indexOf('#')
  if (hashIndex === -1) {
    return pjUrl
  }
  const base = pjUrl.slice(0, hashIndex)
  let fragment = pjUrl.slice(hashIndex + 1)
  // Accept legacy `+` separators by normalizing to `-` for comparisons.
  fragment = fragment.replace(/\+/g, '-')
  return `${base}#${fragment}`
}

function detectEndpointKind(pjUrl: string): PayjoinEndpointKind {
  const normalized = normalizeBip77FragmentDelimiters(pjUrl)
  try {
    const url = new URL(normalized)
    const host = url.hostname.toLowerCase()
    // Directory-style BIP77 endpoints (payjo.in and mailbox paths with fragments).
    if (
      host === 'payjo.in' ||
      host.endsWith('.payjo.in') ||
      normalized.includes('#') ||
      url.pathname.includes('/payjoin/')
    ) {
      return 'bip77'
    }
  } catch {
    // Fall through — treat as BIP78 if it looks like https.
  }
  return 'bip78'
}

function extractQueryPairs(queryString: string): {
  pairs: { key: string; value: string }[]
  pjRaw?: string
  pjosRaw?: string
} {
  // Parse manually so we can keep pj= last and avoid URLSearchParams
  // mutating the pj value.
  const pairs: { key: string; value: string }[] = []
  let pjRaw: string | undefined
  let pjosRaw: string | undefined

  if (!queryString) {
    return { pairs }
  }

  const parts = queryString.split('&')
  for (const part of parts) {
    if (!part) {
      continue
    }
    const eq = part.indexOf('=')
    const key = eq === -1 ? part : part.slice(0, eq)
    const value = eq === -1 ? '' : part.slice(eq + 1)
    const keyLower = key.toLowerCase()
    if (keyLower === 'pj') {
      pjRaw = value
      continue
    }
    if (keyLower === 'pjos') {
      pjosRaw = value
      continue
    }
    pairs.push({ key, value })
  }

  return { pairs, pjRaw, pjosRaw }
}

function parsePayjoinUri(uri: string): ParsePayjoinUriResult {
  const trimmed = uri.trim()
  if (!trimmed) {
    return { error: 'empty', isValid: false }
  }

  const withoutScheme = trimmed.replace(/^bitcoin:/i, '')
  const qIndex = withoutScheme.indexOf('?')
  const address = qIndex === -1 ? withoutScheme : withoutScheme.slice(0, qIndex)
  const query = qIndex === -1 ? '' : withoutScheme.slice(qIndex + 1)

  if (!address) {
    return { error: 'missing address', isValid: false }
  }

  const { pairs, pjRaw, pjosRaw } = extractQueryPairs(query)
  if (!pjRaw) {
    return { error: 'missing pj', isValid: false }
  }

  const pj = normalizePjEndpoint(pjRaw)
  if (!isHttpPjEndpoint(pj)) {
    return { error: 'pj must be http(s) URL', isValid: false }
  }

  let amountBtc: number | undefined
  let label: string | undefined
  let message: string | undefined

  for (const { key, value } of pairs) {
    const keyLower = key.toLowerCase()
    if (keyLower === 'amount' && value) {
      const n = Number(value)
      if (!Number.isNaN(n) && n > 0) {
        amountBtc = n
      }
    } else if (keyLower === 'label' && value) {
      try {
        label = decodeURIComponent(value).replace(/(^["“]|["”]$)/g, '')
      } catch {
        label = value
      }
    } else if (keyLower === 'message' && value) {
      try {
        message = decodeURIComponent(value)
      } catch {
        message = value
      }
    }
  }

  let pjos: 0 | 1 | undefined
  if (pjosRaw !== undefined) {
    if (pjosRaw === '0') {
      pjos = 0
    } else if (pjosRaw === '1') {
      pjos = 1
    }
  }

  const params: PayjoinUriParams = {
    address,
    pj,
    ...(amountBtc !== undefined ? { amountBtc } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(message !== undefined ? { message } : {}),
    ...(pjos !== undefined ? { pjos } : {})
  }

  return {
    endpointKind: detectEndpointKind(pj),
    isValid: true,
    params
  }
}

function hasPayjoinParam(uri: string): boolean {
  return parsePayjoinUri(uri).isValid
}

/**
 * Build a BIP21 Payjoin URI without re-encoding the pj endpoint's ://.
 * Appends amount/label/message first and keeps pj= (and pjos) last (BIP77 SHOULD).
 */
function buildPayjoinUri(params: {
  address: string
  pjEndpoint: string
  amountSats?: number
  label?: string
  message?: string
  pjos?: 0 | 1
  includeBitcoinPrefix?: boolean
}): string {
  const queryParts: string[] = []

  if (params.amountSats !== undefined && params.amountSats > 0) {
    const amountBtc = params.amountSats / SATS_PER_BITCOIN
    const formatted = amountBtc.toFixed(8).replace(/\.?0+$/, '')
    queryParts.push(`amount=${formatted}`)
  }

  if (params.label) {
    queryParts.push(`label=${encodeURIComponent(params.label)}`)
  }

  if (params.message) {
    queryParts.push(`message=${encodeURIComponent(params.message)}`)
  }

  const pjos = params.pjos ?? PAYJOIN_DEFAULT_PJOS
  queryParts.push(`pjos=${pjos}`)

  // pj last: keep :// intact, encode # as %23 (PDK Display form).
  queryParts.push(`pj=${encodePjEndpointForQuery(params.pjEndpoint)}`)

  const query = queryParts.join('&')
  const path = `${params.address}?${query}`
  if (params.includeBitcoinPrefix === false) {
    return path
  }
  return `bitcoin:${path}`
}

/**
 * Take a PDK-produced URI (already valid pj=) and append/replace amount & label
 * without touching the pj endpoint encoding (Bull Bitcoin #2259 lesson).
 *
 * Passing an explicit key with `undefined` clears that BIP21 param (needed for
 * receive-screen Label / amount toggles). Omitting the key keeps the prior value.
 */
function appendParamsToPayjoinUri(
  pdkUri: string,
  extras: {
    amountSats?: number
    label?: string
    message?: string
    pjos?: 0 | 1
  }
): string {
  const parsed = parsePayjoinUri(pdkUri)
  if (!parsed.isValid || !parsed.params) {
    throw new Error(
      `invalid payjoin URI from PDK${parsed.error ? `: ${parsed.error}` : ''}`
    )
  }

  const amountSats = Object.hasOwn(extras, 'amountSats')
    ? extras.amountSats
    : parsed.params.amountBtc !== undefined
      ? Math.round(parsed.params.amountBtc * SATS_PER_BITCOIN)
      : undefined

  const label = Object.hasOwn(extras, 'label')
    ? extras.label
    : parsed.params.label

  const message = Object.hasOwn(extras, 'message')
    ? extras.message
    : parsed.params.message

  return buildPayjoinUri({
    address: parsed.params.address,
    amountSats,
    label,
    message,
    pjEndpoint: parsed.params.pj,
    pjos: extras.pjos ?? parsed.params.pjos ?? PAYJOIN_DEFAULT_PJOS
  })
}

function isDirectoryEndpoint(pjUrl: string): boolean {
  try {
    const url = new URL(normalizeBip77FragmentDelimiters(pjUrl))
    return (
      url.hostname.toLowerCase() === 'payjo.in' ||
      url.hostname.toLowerCase().endsWith('.payjo.in') ||
      url.origin === new URL(PAYJOIN_DIRECTORY_URL).origin
    )
  } catch {
    return false
  }
}

function acceptsFragmentDelimiter(
  pjUrl: string,
  delimiter: '+' | '-'
): boolean {
  const hashIndex = pjUrl.indexOf('#')
  if (hashIndex === -1) {
    return false
  }
  const fragment = pjUrl.slice(hashIndex + 1)
  if (delimiter === '+') {
    return fragment.includes('+')
  }
  // `-` as fragment param separator (not inside base64url tokens alone is hard);
  // treat presence of `-` between params as acceptance after normalizing.
  return /[A-Za-z0-9]=/.test(fragment) && fragment.includes('-')
}

export {
  BIP77_FRAGMENT_DELIMITERS,
  appendParamsToPayjoinUri,
  acceptsFragmentDelimiter,
  buildPayjoinUri,
  decodePjParam,
  detectEndpointKind,
  encodePjEndpointForQuery,
  hasPayjoinParam,
  isDirectoryEndpoint,
  isHttpPjEndpoint,
  normalizeBip77FragmentDelimiters,
  normalizePjEndpoint,
  parsePayjoinUri
}

export type { ParsePayjoinUriResult }
