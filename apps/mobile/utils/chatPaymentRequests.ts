import { MS_PER_SECOND } from '@/constants/time'
import type { Network } from '@/types/settings/blockchain'
import { getBolt11Network } from '@/utils/bolt11Network'
import {
  bolt11AmountSats,
  decodeLightningInvoice
} from '@/utils/lightningInvoiceDecoder'

/** A message can carry many invoices; only the first few become cards. */
export const CHAT_PAYMENT_REQUESTS_MAX = 3

// BOLT11 default when the invoice has no expiry field.
const BOLT11_DEFAULT_EXPIRY_SEC = 3600

// Optional `lightning:` scheme, then a bech32 bolt11 body. The lookbehind
// keeps words that merely contain "lnbc" (e.g. "kilnbcd") from matching.
const BOLT11_IN_TEXT_RE =
  /(?<![a-z0-9])(?:lightning:)?(ln(?:bcrt|bc|tbs|tb)[0-9a-z]{50,})/gi

type ChatInvoice = {
  amountSats: number
  description: string
  /** Unix seconds; null when the invoice carries no timestamp. */
  expiresAt: number | null
  invoice: string
  network: Network | null
}

/** Decoded bolt11 invoices found in a chat message, deduplicated and capped. */
function findChatInvoices(text: string): ChatInvoice[] {
  const seen = new Set<string>()
  const invoices: ChatInvoice[] = []
  for (const match of text.matchAll(BOLT11_IN_TEXT_RE)) {
    if (invoices.length >= CHAT_PAYMENT_REQUESTS_MAX) {
      break
    }
    const invoice = match[1].toLowerCase()
    if (seen.has(invoice)) {
      continue
    }
    seen.add(invoice)
    const decoded = decodeChatInvoice(invoice)
    if (decoded) {
      invoices.push(decoded)
    }
  }
  return invoices
}

function decodeChatInvoice(invoice: string): ChatInvoice | null {
  try {
    const decoded = decodeLightningInvoice(invoice)
    const timestamp = Number.parseInt(decoded.timestamp, 10)
    const expiry = Number.parseInt(decoded.expiry, 10)
    const expirySec = Number.isNaN(expiry) ? BOLT11_DEFAULT_EXPIRY_SEC : expiry
    return {
      amountSats: bolt11AmountSats(decoded),
      description: decoded.description,
      expiresAt: Number.isNaN(timestamp) ? null : timestamp + expirySec,
      invoice,
      network: getBolt11Network(invoice)
    }
  } catch {
    return null
  }
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

export { findChatInvoices, isChatInvoiceExpired }
export type { ChatInvoice }
