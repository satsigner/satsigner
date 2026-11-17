import { SATS_PER_BITCOIN } from '@/constants/btc'
import { BOLT11_DEFAULT_EXPIRY_SECONDS } from '@/constants/lightning'
import { MS_PER_MINUTE, MS_PER_SECOND } from '@/constants/time'
import type { Network } from '@/types/settings/blockchain'
import { parseBitcoinUri } from '@/utils/bip321'
import { getBolt11Network } from '@/utils/bolt11Network'
import {
  bolt11AmountSats,
  decodeLightningInvoice
} from '@/utils/lightningInvoiceDecoder'
import { hasMalformedUriEncoding, hasRequiredUriParam } from '@/utils/parse'

/** A message can carry many payment requests; only the first few become cards. */
export const CHAT_PAYMENT_REQUESTS_MAX = 3

/** An open invoice this close to expiry is flagged so it gets paid in time. */
export const CHAT_INVOICE_EXPIRING_SOON_MS = 10 * MS_PER_MINUTE

// Optional `lightning:` scheme, then a bech32 bolt11 body. The lookbehind
// keeps words that merely contain "lnbc" (e.g. "kilnbcd") from matching.
const BOLT11_IN_TEXT_RE =
  /(?<![a-z0-9])(?:lightning:)?(ln(?:bcrt|bc|tbs|tb)[0-9a-z]{50,})/gi

// A bitcoin: URI runs until whitespace or a character that can't appear
// unencoded in a URI and usually closes markdown or prose around it.
const BITCOIN_URI_IN_TEXT_RE = /(?<![a-z0-9])bitcoin:[^\s<>"'`()[\]{}]+/gi
const URI_TRAILING_PUNCTUATION_RE = /[.,;:!?*_~]+$/

type ChatInvoice = {
  kind: 'lightning'
  amountSats: number
  description: string
  /** Unix seconds; null when the invoice carries no timestamp. */
  createdAt: number | null
  /** Unix seconds; null when the invoice carries no timestamp. */
  expiresAt: number | null
  invoice: string
  network: Network | null
}

type ChatBitcoinRequest = {
  kind: 'bitcoin'
  address: string
  /** 0 when the URI asks for no amount. */
  amountSats: number
  label: string
  message: string
  network: Network | null
  hasLightningFallback: boolean
  uri: string
}

type ChatPaymentRequest = ChatInvoice | ChatBitcoinRequest

type ChatInvoiceTiming =
  | { state: 'unknown' }
  | { state: 'open' | 'expiringSoon' | 'expired'; expiresAtMs: number }

type TextMatch = {
  start: number
  end: number
  request: ChatPaymentRequest | null
}

function decodeChatInvoice(invoice: string): ChatInvoice | null {
  try {
    const decoded = decodeLightningInvoice(invoice)
    const timestamp = Number.parseInt(decoded.timestamp, 10)
    const expiry = Number.parseInt(decoded.expiry, 10)
    const expirySec = Number.isNaN(expiry)
      ? BOLT11_DEFAULT_EXPIRY_SECONDS
      : expiry
    const createdAt = Number.isNaN(timestamp) ? null : timestamp
    return {
      amountSats: bolt11AmountSats(decoded),
      createdAt,
      description: decoded.description,
      expiresAt: createdAt === null ? null : createdAt + expirySec,
      invoice,
      kind: 'lightning',
      network: getBolt11Network(invoice)
    }
  } catch {
    return null
  }
}

/**
 * A BIP21 URI as a payable request. A required parameter we don't understand
 * makes it unpayable (BIP21), and broken encoding would show a label the
 * payee never wrote, so both are dropped.
 */
function parseChatBitcoinUri(uri: string): ChatPaymentRequest | null {
  if (hasRequiredUriParam(uri) || hasMalformedUriEncoding(uri)) {
    return null
  }
  const parsed = parseBitcoinUri(uri)
  if (!parsed.isValid) {
    return null
  }
  if (!parsed.address) {
    return parsed.lightning
      ? decodeChatInvoice(parsed.lightning.toLowerCase())
      : null
  }
  return {
    address: parsed.address,
    amountSats: parsed.amount
      ? Math.round(parsed.amount * SATS_PER_BITCOIN)
      : 0,
    hasLightningFallback: Boolean(parsed.lightning),
    kind: 'bitcoin',
    label: parsed.label ?? '',
    message: parsed.message ?? '',
    network: parsed.network ?? null,
    uri
  }
}

function findBitcoinUriMatches(text: string): TextMatch[] {
  return [...text.matchAll(BITCOIN_URI_IN_TEXT_RE)].map((match) => {
    const uri = match[0].replace(URI_TRAILING_PUNCTUATION_RE, '')
    return {
      end: match.index + match[0].length,
      request: parseChatBitcoinUri(uri),
      start: match.index
    }
  })
}

function findInvoiceMatches(text: string, skip: TextMatch[]): TextMatch[] {
  return [...text.matchAll(BOLT11_IN_TEXT_RE)]
    .filter(
      (match) =>
        !skip.some(
          (range) => match.index >= range.start && match.index < range.end
        )
    )
    .map((match) => ({
      end: match.index + match[0].length,
      request: decodeChatInvoice(match[1].toLowerCase()),
      start: match.index
    }))
}

function getRequestKey(request: ChatPaymentRequest) {
  return request.kind === 'lightning' ? request.invoice : request.uri
}

/**
 * Decoded payment requests found in a chat message, in reading order,
 * deduplicated and capped. An invoice inside a bitcoin: URI (its lightning
 * fallback) belongs to that URI's card. Anything that fails to decode is
 * dropped, so a malformed request never looks payable.
 */
function findChatPaymentRequests(text: string): ChatPaymentRequest[] {
  const uriMatches = findBitcoinUriMatches(text)
  const matches = [...uriMatches, ...findInvoiceMatches(text, uriMatches)]
  const requests = matches
    .toSorted((a, b) => a.start - b.start)
    .flatMap((match) => (match.request ? [match.request] : []))

  const seen = new Set<string>()
  const unique: ChatPaymentRequest[] = []
  for (const request of requests) {
    const key = getRequestKey(request)
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(request)
    }
  }
  return unique.slice(0, CHAT_PAYMENT_REQUESTS_MAX)
}

/** The text is mostly a bolt11 the card already shows, so it can collapse. */
function hasChatInvoice(requests: ChatPaymentRequest[]): boolean {
  return requests.some((request) => request.kind === 'lightning')
}

function isChatInvoiceExpired(
  invoice: Pick<ChatInvoice, 'expiresAt'>,
  nowMs = Date.now()
): boolean {
  if (invoice.expiresAt === null) {
    return false
  }
  return invoice.expiresAt * MS_PER_SECOND <= nowMs
}

/** Where an invoice stands against its expiry, for the card's status line. */
function getChatInvoiceTiming(
  invoice: Pick<ChatInvoice, 'expiresAt'>,
  nowMs: number
): ChatInvoiceTiming {
  if (invoice.expiresAt === null) {
    return { state: 'unknown' }
  }
  const expiresAtMs = invoice.expiresAt * MS_PER_SECOND
  if (expiresAtMs <= nowMs) {
    return { expiresAtMs, state: 'expired' }
  }
  if (expiresAtMs - nowMs <= CHAT_INVOICE_EXPIRING_SOON_MS) {
    return { expiresAtMs, state: 'expiringSoon' }
  }
  return { expiresAtMs, state: 'open' }
}

function isChatPaymentRequestExpired(
  request: ChatPaymentRequest,
  nowMs = Date.now()
): boolean {
  return request.kind === 'lightning' && isChatInvoiceExpired(request, nowMs)
}

export {
  findChatPaymentRequests,
  getChatInvoiceTiming,
  getRequestKey,
  hasChatInvoice,
  isChatInvoiceExpired,
  isChatPaymentRequestExpired
}
export type {
  ChatBitcoinRequest,
  ChatInvoice,
  ChatInvoiceTiming,
  ChatPaymentRequest
}
